import base64
import json
import re
import unicodedata
from typing import Dict, List, Optional, Tuple

import boto3

textract = boto3.client("textract")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}

NOISE_WORDS = {
    "CEDULA",
    "CÉDULA",
    "IDENTIDAD",
    "REPUBLICA",
    "BOLIVARIANA",
    "VENEZUELA",
    "FIRMA",
    "TITULAR",
    "DIRECTOR",
    "NACIONALIDAD",
    "VENEZOLANO",
    "EXPEDICION",
    "VENCIMIENTO",
    "FECHA",
    "NACIMIENTO",
    "CASADA",
    "SOLTERA",
    "CONTRIBUYENTE",
    "SENIAT",
}
TRAILING_GARBAGE = {"NA", "N", "A", "EA", "ER", "OD", "DI", "RR", "ZN"}
CONNECTORS = {"DE", "DEL", "LA", "LAS", "LOS", "DA", "DAS", "DO", "DOS"}

APELLIDO_LABEL = re.compile(r"APELL|APELID|PELLID|ELLID|AVEL", re.IGNORECASE)
NOMBRE_LABEL = re.compile(r"NOMB|NOMBR|NOMER|NOME|N0MB|NOM8|VOVER|VOBER|VOWER", re.IGNORECASE)
CEDULA_RE = re.compile(r"\b([VE])\s*[-.]?\s*(\d(?:[\d.\s-]{5,12}\d))\b", re.IGNORECASE)
RIF_RE = re.compile(r"\b([JGVEP])\s*[-.]?\s*(\d(?:[\d.\s-]{7,12}\d))\b", re.IGNORECASE)


def normalize_upper(value: str) -> str:
    no_acc = "".join(c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn")
    return no_acc.upper()


def safe_json_response(status_code: int, payload: Dict) -> Dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(payload, ensure_ascii=False),
    }


def parse_event_json(event: Dict) -> Dict:
    body = event.get("body", "")
    if event.get("isBase64Encoded"):
        try:
            body = base64.b64decode(body).decode("utf-8")
        except Exception:
            # Si body es un archivo binario/base64 directo y no JSON UTF-8,
            # lo exponemos como imagen para flujo de compatibilidad.
            return {"frontImageBase64": event.get("body", "")}
    if isinstance(body, str):
        try:
            return json.loads(body or "{}")
        except json.JSONDecodeError:
            # Compatibilidad para pruebas donde body llega como base64 crudo.
            return {"frontImageBase64": body}
    return body or {}


def parse_image_b64(image_b64: str) -> bytes:
    cleaned = (image_b64 or "").strip()
    if "," in cleaned:
        cleaned = cleaned.split(",", 1)[1]
    cleaned = cleaned.replace(" ", "+")
    return base64.b64decode(cleaned)


def clean_person_text(value: str) -> str:
    text = re.sub(r"\b(NA\)|N\)|DIRECTOR|TITULAR|FIRMA|AUTORIZADA)\b.*$", " ", value, flags=re.IGNORECASE)
    text = re.sub(r"[^A-Za-zÁÉÍÓÚÑáéíóúñ\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    tokens = []
    for t in text.split():
        if normalize_upper(t) in NOISE_WORDS:
            continue
        tokens.append(t)

    while tokens:
        tail = tokens[-1]
        upper_tail = normalize_upper(tail)
        if upper_tail in TRAILING_GARBAGE:
            tokens.pop()
            continue
        if len(tail) <= 2 and upper_tail not in CONNECTORS:
            tokens.pop()
            continue
        break
    while tokens and normalize_upper(tokens[-1]) in CONNECTORS:
        tokens.pop()

    return " ".join(tokens).strip()


def score_person_candidate(value: str) -> int:
    candidate = clean_person_text(value)
    if not candidate:
        return -1
    parts = candidate.split()
    if len(parts) < 2 or len(parts) > 6:
        return -1
    if any(any(ch.isdigit() for ch in p) for p in parts):
        return -1
    long_words = sum(1 for p in parts if len(p) >= 3)
    return long_words * 3 + len(candidate)


def pick_best_person_candidate(candidates: List[str]) -> str:
    scored = []
    for c in candidates:
        if not c:
            continue
        cleaned = clean_person_text(c)
        score = score_person_candidate(cleaned)
        if score >= 0:
            scored.append((cleaned, score))
    scored.sort(key=lambda x: (x[1], len(x[0])), reverse=True)
    return scored[0][0] if scored else ""


def normalize_doc_number(raw: str, expected: str) -> Optional[str]:
    compact = (
        raw.upper()
        .replace(" ", "")
        .replace(".", "")
        .replace("-", "")
        .replace("O", "0")
        .replace("Q", "0")
        .replace("I", "1")
        .replace("L", "1")
        .replace("S", "5")
        .replace("B", "8")
    )
    if expected == "CEDULA":
        if re.fullmatch(r"[VE]\d{6,10}", compact):
            return compact
        if re.fullmatch(r"\d{6,10}", compact):
            return "V" + compact
        return None
    if re.fullmatch(r"[JGVEP]\d{8,10}", compact):
        return compact
    return None


def textract_lines_from_image(image_bytes: bytes) -> Tuple[List[str], List[float]]:
    response = textract.detect_document_text(Document={"Bytes": image_bytes})
    lines = []
    confs = []
    for block in response.get("Blocks", []):
        if block.get("BlockType") == "LINE":
            text = (block.get("Text") or "").strip()
            if text:
                lines.append(text)
                confs.append(float(block.get("Confidence", 0.0)))
    return lines, confs


def detect_document_type(text: str, hint: str = "") -> str:
    normalized = normalize_upper(text)
    hint_norm = normalize_upper(hint or "")
    if "RIF" in hint_norm:
        return "RIF"
    if "CEDULA" in hint_norm:
        return "CEDULA"
    if "RIF" in normalized or "SENIAT" in normalized or "CONTRIBUYENTE" in normalized:
        return "RIF"
    return "CEDULA"


def extract_identity_from_cedula(lines: List[str], joined: str) -> Dict[str, Optional[str]]:
    names = ""
    surnames = ""

    for i, line in enumerate(lines):
        normalized = normalize_upper(line)
        right_part = line.split("|")[1] if "|" in line else ""
        left_part = line.split("|")[0]
        next_line = lines[i + 1] if i + 1 < len(lines) else ""

        if not surnames and APELLIDO_LABEL.search(normalized):
            cands = [
                re.sub(r".*(APELL\w*|APELID\w*|ELLID\w*|AVEL\w*)", "", left_part, flags=re.IGNORECASE),
                right_part,
                next_line,
                left_part,
            ]
            surnames = pick_best_person_candidate(cands)

        if not names and NOMBRE_LABEL.search(normalized):
            cands = [
                re.sub(r".*(N\w{0,4}OMB\w*|NOMER\w*|NOME\w*|VOW?ER\w*|N0MB\w*|NOM8\w*)", "", left_part, flags=re.IGNORECASE),
                right_part,
                next_line,
                left_part,
            ]
            names = pick_best_person_candidate(cands)

    doc_num = None
    match = CEDULA_RE.search(joined)
    if match:
        doc_num = normalize_doc_number(f"{match.group(1)}{match.group(2)}", "CEDULA")
    if not doc_num:
        fallback = re.search(r"\b\d{6,10}\b", joined)
        if fallback:
            doc_num = normalize_doc_number(fallback.group(0), "CEDULA")

    return {
        "documentType": "CEDULA",
        "givenNames": names or None,
        "surnames": surnames or None,
        "documentNumber": doc_num,
    }


def extract_identity_from_rif(lines: List[str], joined: str) -> Dict[str, Optional[str]]:
    rif = None
    match = RIF_RE.search(joined)
    if match:
        rif = normalize_doc_number(f"{match.group(1)}{match.group(2)}", "RIF")

    razon_social = ""
    for i, line in enumerate(lines):
        normalized = normalize_upper(line)
        if "RAZON SOCIAL" in normalized or "RAZÓN SOCIAL" in normalized:
            cleaned = re.sub(r".*RAZ[ÓO]N\s+SOCIAL\s*[:\-]?", "", line, flags=re.IGNORECASE)
            if cleaned.strip():
                razon_social = clean_person_text(cleaned)
            elif i + 1 < len(lines):
                razon_social = clean_person_text(lines[i + 1])
            break

    if not razon_social:
        candidates = []
        for line in lines:
            cleaned = clean_person_text(line)
            upper = normalize_upper(cleaned)
            if not cleaned:
                continue
            if len(cleaned.split()) < 2:
                continue
            if any(x in upper for x in ["SENIAT", "RIF", "FECHA", "DOMICILIO", "CONTRIBUYENTE"]):
                continue
            candidates.append(cleaned)
        razon_social = pick_best_person_candidate(candidates)

    return {
        "documentType": "RIF",
        "givenNames": razon_social or None,
        "surnames": None,
        "documentNumber": rif,
    }


def lambda_handler(event, context):
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    if method == "OPTIONS":
        return safe_json_response(200, {"ok": True})

    try:
        data = parse_event_json(event)
        # Aceptamos alias para distintas pruebas/manuales en Lambda Console.
        front_b64 = data.get("frontImageBase64") or data.get("fileBase64")
        if not front_b64:
            return safe_json_response(400, {"message": "frontImageBase64 (o fileBase64) es requerido"})

        image_bytes = parse_image_b64(front_b64)
        lines, confs = textract_lines_from_image(image_bytes)
        joined = "\n".join(lines)

        doc_type = detect_document_type(joined, str(data.get("documentTypeHint") or ""))
        extracted = extract_identity_from_rif(lines, joined) if doc_type == "RIF" else extract_identity_from_cedula(lines, joined)

        warnings = []
        if not extracted.get("givenNames") and doc_type == "CEDULA":
            warnings.append("No se pudieron extraer nombres con confianza.")
        if not extracted.get("surnames") and doc_type == "CEDULA":
            warnings.append("No se pudieron extraer apellidos con confianza.")
        if not extracted.get("documentNumber"):
            warnings.append("No se pudo extraer numero de documento con confianza.")

        avg_conf = (sum(confs) / len(confs) / 100.0) if confs else 0.0
        if avg_conf < 0.70:
            warnings.append("OCR con baja confianza general.")

        fields = {
            "documentType": extracted.get("documentType", ""),
            "givenNames": extracted.get("givenNames") or "",
            "surnames": extracted.get("surnames") or "",
            "documentNumber": extracted.get("documentNumber") or "",
            # aliases usados por tu frontend
            "nombres": extracted.get("givenNames") or "",
            "apellidos": extracted.get("surnames") or "",
            "cedula": extracted.get("documentNumber") or "",
            "rif": extracted.get("documentNumber") or "",
        }

        confidence = {
            "givenNames": 0.85 if fields["givenNames"] else 0.25,
            "surnames": 0.85 if fields["surnames"] else 0.25,
            "documentNumber": 0.90 if fields["documentNumber"] else 0.25,
            "ocrAverage": round(avg_conf, 3),
        }

        return safe_json_response(
            200,
            {
                "fields": fields,
                "confidence": confidence,
                "warnings": warnings,
                "documentTypeDetected": doc_type,
            },
        )
    except Exception as exc:
        return safe_json_response(500, {"message": "Error procesando documento", "error": str(exc)})
