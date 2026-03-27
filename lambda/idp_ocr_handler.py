import base64
import json
import os
import re
import time
import unicodedata
import uuid
from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

import boto3

textract = boto3.client("textract")
s3 = boto3.client("s3")

# Requerido para PDF (Textract async)
DOCUMENT_OCR_BUCKET = os.getenv("DOCUMENT_OCR_BUCKET", "").strip()
DOCUMENT_OCR_POLL_SECONDS = float(os.getenv("DOCUMENT_OCR_POLL_SECONDS", "1.5"))
DOCUMENT_OCR_MAX_WAIT_SECONDS = int(os.getenv("DOCUMENT_OCR_MAX_WAIT_SECONDS", "90"))

# Recomendación: manejar CORS en Lambda Function URL para evitar duplicados.
RESPONSE_HEADERS = {
    "Content-Type": "application/json"
}

CEDULA_RE = re.compile(r"\b([VE])\s*[-.]?\s*(\d(?:[\d.\s-]{5,12}\d))\b", re.IGNORECASE)
RIF_RE = re.compile(r"\b([JGVEP])\s*[-.]?\s*(\d(?:[\d.\s-]{7,12}\d))\b", re.IGNORECASE)
DATE_RE = re.compile(r"\b(\d{2})[/-](\d{2})[/-](\d{4})\b")

NOISE_WORDS = {
    "CEDULA", "CÉDULA", "IDENTIDAD", "REPUBLICA", "BOLIVARIANA", "VENEZUELA",
    "FIRMA", "TITULAR", "DIRECTOR", "NACIONALIDAD", "VENEZOLANO",
    "EXPEDICION", "VENCIMIENTO", "FECHA", "NACIMIENTO", "CASADA", "SOLTERA",
    "CONTRIBUYENTE", "SENIAT", "REGISTRO", "MERCANTIL", "ACTA", "CONSTITUTIVA",
    "NOMBRES", "NOMBRE", "APELLIDOS", "APELLIDO", "FUND", "AUTORIZADA"
}
TRAILING_GARBAGE = {"NA", "N", "A", "EA", "ER", "OD", "DI", "RR", "ZN"}
CONNECTORS = {"DE", "DEL", "LA", "LAS", "LOS", "DA", "DAS", "DO", "DOS"}

APELLIDO_LABEL = re.compile(r"APELL|APELID|PELLID|ELLID|AVEL", re.IGNORECASE)
NOMBRE_LABEL = re.compile(r"NOMB|NOMBR|NOMER|NOME|N0MB|NOM8|VOVER|VOBER|VOWER", re.IGNORECASE)


def normalize_upper(value: str) -> str:
    no_acc = "".join(c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn")
    return no_acc.upper().strip()


def normalize_doc_type(value: str) -> str:
    v = normalize_upper(value or "").replace(" ", "_")
    aliases = {
        "ACTA": "ACTA_CONSTITUTIVA",
        "ACTA_CONSTITUTIVA": "ACTA_CONSTITUTIVA",
        "REGISTRO_MERCANTIL": "ACTA_CONSTITUTIVA",
        "CEDULA": "CEDULA",
        "CÉDULA": "CEDULA",
        "RIF": "RIF",
        "PASAPORTE": "PASAPORTE",
        "LICENCIA": "LICENCIA",
    }
    return aliases.get(v, "OTRO" if v else "")


def safe_json_response(status_code: int, payload: Dict) -> Dict:
    return {
        "statusCode": status_code,
        "headers": RESPONSE_HEADERS,
        "body": json.dumps(payload, ensure_ascii=False),
    }


def parse_event_json(event: Dict) -> Dict:
    body = event.get("body", "")
    if event.get("isBase64Encoded"):
        try:
            body = base64.b64decode(body).decode("utf-8")
        except Exception:
            return {"fileBase64": event.get("body", "")}
    if isinstance(body, str):
        try:
            return json.loads(body or "{}")
        except json.JSONDecodeError:
            return {"fileBase64": body}
    return body or {}


def parse_b64_payload(raw: str) -> Tuple[bytes, str]:
    if not raw:
        raise ValueError("fileBase64 vacío")
    cleaned = raw.strip()
    mime_hint = ""
    if cleaned.startswith("data:") and ";base64," in cleaned:
        header, b64_part = cleaned.split(";base64,", 1)
        mime_hint = header.replace("data:", "").strip().lower()
        cleaned = b64_part
    cleaned = cleaned.replace(" ", "+")
    return base64.b64decode(cleaned), mime_hint


def detect_file_kind(file_bytes: bytes, mime_hint: str = "", file_name: str = "", content_type: str = "") -> str:
    mh = (mime_hint or content_type or "").lower()
    fn = (file_name or "").lower()

    if "pdf" in mh or fn.endswith(".pdf"):
        return "pdf"
    if "jpeg" in mh or "jpg" in mh or "png" in mh or fn.endswith(".jpg") or fn.endswith(".jpeg") or fn.endswith(".png"):
        return "image"

    if file_bytes.startswith(b"%PDF"):
        return "pdf"
    if file_bytes.startswith(b"\xff\xd8\xff") or file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image"

    return "image"


def textract_lines_from_image_bytes(image_bytes: bytes) -> Tuple[List[str], List[float]]:
    response = textract.detect_document_text(Document={"Bytes": image_bytes})
    lines, confs = [], []
    for block in response.get("Blocks", []):
        if block.get("BlockType") == "LINE":
            text = (block.get("Text") or "").strip()
            if text:
                lines.append(text)
                confs.append(float(block.get("Confidence", 0.0)))
    return lines, confs


def textract_lines_from_pdf_bytes(pdf_bytes: bytes) -> Tuple[List[str], List[float]]:
    if not DOCUMENT_OCR_BUCKET:
        raise ValueError("PDF recibido, pero falta variable DOCUMENT_OCR_BUCKET.")

    key = f"document-ocr-input/{uuid.uuid4()}.pdf"
    s3.put_object(Bucket=DOCUMENT_OCR_BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")

    try:
        start_resp = textract.start_document_text_detection(
            DocumentLocation={"S3Object": {"Bucket": DOCUMENT_OCR_BUCKET, "Name": key}}
        )
        job_id = start_resp["JobId"]

        deadline = time.time() + DOCUMENT_OCR_MAX_WAIT_SECONDS
        status = "IN_PROGRESS"

        while time.time() < deadline:
            page = textract.get_document_text_detection(JobId=job_id, MaxResults=1000)
            status = page.get("JobStatus", "IN_PROGRESS")
            if status in ("SUCCEEDED", "FAILED", "PARTIAL_SUCCESS"):
                break
            time.sleep(DOCUMENT_OCR_POLL_SECONDS)

        if status not in ("SUCCEEDED", "PARTIAL_SUCCESS"):
            raise RuntimeError(f"Textract PDF no completó correctamente. Estado: {status}")

        lines, confs = [], []
        next_token = None
        while True:
            if next_token:
                page = textract.get_document_text_detection(JobId=job_id, MaxResults=1000, NextToken=next_token)
            else:
                page = textract.get_document_text_detection(JobId=job_id, MaxResults=1000)

            for block in page.get("Blocks", []):
                if block.get("BlockType") == "LINE":
                    text = (block.get("Text") or "").strip()
                    if text:
                        lines.append(text)
                        confs.append(float(block.get("Confidence", 0.0)))

            next_token = page.get("NextToken")
            if not next_token:
                break

        return lines, confs
    finally:
        try:
            s3.delete_object(Bucket=DOCUMENT_OCR_BUCKET, Key=key)
        except Exception:
            pass


def textract_lines(file_bytes: bytes, file_kind: str) -> Tuple[List[str], List[float]]:
    if file_kind == "pdf":
        return textract_lines_from_pdf_bytes(file_bytes)
    return textract_lines_from_image_bytes(file_bytes)


def detect_document_type(text: str) -> str:
    normalized = normalize_upper(text)
    if "ACTA CONSTITUTIVA" in normalized or "REGISTRO MERCANTIL" in normalized:
        return "ACTA_CONSTITUTIVA"
    if "RIF" in normalized or "SENIAT" in normalized or "CONTRIBUYENTE" in normalized:
        return "RIF"
    if "CEDULA" in normalized or "CÉDULA" in normalized or "IDENTIDAD" in normalized:
        return "CEDULA"
    return "OTRO"


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


def strip_name_label(line: str, label_kind: str) -> str:
    if label_kind == "surname":
        return re.sub(
            r".*(APELL(?:IDOS?)?|APELID(?:OS?)?|PELLID|ELLID|AVEL)\s*[:\-]?\s*",
            "",
            line,
            flags=re.IGNORECASE,
        ).strip()
    return re.sub(
        r".*(N\w{0,4}OMB\w*|NOMER\w*|NOME\w*|VOW?ER\w*|N0MB\w*|NOM8\w*)\s*[:\-]?\s*",
        "",
        line,
        flags=re.IGNORECASE,
    ).strip()


def fix_person_field(value: str) -> str:
    cleaned = clean_person_text(value)
    cleaned = re.sub(r"^(NOMBRES?|APELLIDOS?)\s+", "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned


def score_person_candidate(value: str) -> int:
    candidate = clean_person_text(value)
    if not candidate:
        return -1
    parts = candidate.split()
    if len(parts) < 2 or len(parts) > 8:
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

    if expected == "RIF":
        if re.fullmatch(r"[JGVEP]\d{8,10}", compact):
            return compact
        return None

    return compact or None


def build_official_signature_noise(lines: List[str]) -> List[str]:
    """
    Detecta nombres de firma/director para removerlos cuando OCR los pega
    al final de nombres/apellidos de la cédula.
    """
    noise = []
    for i, line in enumerate(lines):
        up = normalize_upper(line)
        if "DIRECTOR" in up or "AUTORIZADA" in up:
            # misma línea sin palabra clave
            same = re.sub(r"\b(DIRECTOR|AUTORIZADA)\b", " ", line, flags=re.IGNORECASE)
            same = fix_person_field(same)
            if score_person_candidate(same) >= 0:
                noise.append(same)

            # línea anterior puede contener nombre de firma
            if i > 0:
                prev = fix_person_field(lines[i - 1])
                if score_person_candidate(prev) >= 0:
                    noise.append(prev)

            # línea actual completa también puede venir como "Juan Dugarte Director"
            cleaned_line = fix_person_field(line)
            if score_person_candidate(cleaned_line) >= 0:
                noise.append(cleaned_line)

    # dedupe
    dedup = []
    seen = set()
    for n in noise:
        key = normalize_upper(n)
        if key and key not in seen:
            seen.add(key)
            dedup.append(n)
    return dedup


def remove_official_noise(candidate: str, official_noise: List[str]) -> str:
    out = candidate.strip()
    up_out = normalize_upper(out)

    for n in official_noise:
        up_n = normalize_upper(n)
        if not up_n:
            continue

        # si el candidato termina con nombre de director/firma, lo recorta
        if up_out.endswith(" " + up_n):
            out = out[: len(out) - len(n) - 1].strip()
            up_out = normalize_upper(out)
        elif up_out == up_n:
            out = ""
            up_out = ""

    return out.strip()


def extract_identity_from_cedula(lines: List[str], joined: str) -> Dict[str, Optional[str]]:
    names, surnames = "", ""
    official_noise = build_official_signature_noise(lines)

    for i, line in enumerate(lines):
        normalized = normalize_upper(line)
        next_line = lines[i + 1] if i + 1 < len(lines) else ""

        if not surnames and APELLIDO_LABEL.search(normalized):
            same_line = fix_person_field(strip_name_label(line, "surname"))
            same_line = remove_official_noise(same_line, official_noise)
            if score_person_candidate(same_line) >= 0:
                surnames = same_line
            else:
                alt = fix_person_field(next_line)
                alt = remove_official_noise(alt, official_noise)
                if score_person_candidate(alt) >= 0:
                    surnames = alt

        if not names and NOMBRE_LABEL.search(normalized):
            same_line = fix_person_field(strip_name_label(line, "name"))
            same_line = remove_official_noise(same_line, official_noise)
            if score_person_candidate(same_line) >= 0:
                names = same_line
            else:
                alt = fix_person_field(next_line)
                alt = remove_official_noise(alt, official_noise)
                if score_person_candidate(alt) >= 0:
                    names = alt

    # fallback conservador
    if not names or not surnames:
        conservative_candidates = []
        for line in lines:
            upper = normalize_upper(line)
            if any(x in upper for x in ("DIRECTOR", "FIRMA", "TITULAR", "VENEZOLANO", "EXPEDICION", "VENCIMIENTO")):
                continue
            cleaned = fix_person_field(line)
            cleaned = remove_official_noise(cleaned, official_noise)
            if score_person_candidate(cleaned) >= 0:
                conservative_candidates.append(cleaned)

        if not names:
            names = pick_best_person_candidate(conservative_candidates)
        if not surnames and conservative_candidates:
            for c in conservative_candidates:
                if c != names:
                    surnames = c
                    break

    doc_num = None
    m = CEDULA_RE.search(joined)
    if m:
        doc_num = normalize_doc_number(f"{m.group(1)}{m.group(2)}", "CEDULA")
    if not doc_num:
        line_hit = re.search(r"\b([VE])\s*[\.:-]?\s*(\d[\d.\s-]{5,12}\d)\b", joined, flags=re.IGNORECASE)
        if line_hit:
            doc_num = normalize_doc_number(f"{line_hit.group(1)}{line_hit.group(2)}", "CEDULA")
    if not doc_num:
        fallback = re.search(r"\b\d{6,10}\b", joined)
        if fallback:
            doc_num = normalize_doc_number(fallback.group(0), "CEDULA")

    return {
        "documentType": "CEDULA",
        "documentNumber": doc_num,
        "givenNames": names or None,
        "surnames": surnames or None,
        "companyName": None,
    }


def extract_identity_from_rif(lines: List[str], joined: str) -> Dict[str, Optional[str]]:
    rif = None
    m = RIF_RE.search(joined)
    if m:
        rif = normalize_doc_number(f"{m.group(1)}{m.group(2)}", "RIF")

    company_name = ""
    for i, line in enumerate(lines):
        norm = normalize_upper(line)
        if "RAZON SOCIAL" in norm or "RAZÓN SOCIAL" in norm or "DENOMINACION" in norm or "DENOMINACIÓN" in norm:
            cleaned = re.sub(r".*(RAZ[ÓO]N\s+SOCIAL|DENOMINACI[ÓO]N)\s*[:\-]?", "", line, flags=re.IGNORECASE)
            if cleaned.strip():
                company_name = clean_person_text(cleaned)
            elif i + 1 < len(lines):
                company_name = clean_person_text(lines[i + 1])
            break

    if not company_name:
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
        company_name = pick_best_person_candidate(candidates)

    return {
        "documentType": "RIF",
        "documentNumber": rif,
        "givenNames": None,
        "surnames": None,
        "companyName": company_name or None,
    }


def _parse_ddmmyyyy(text: str) -> Optional[date]:
    m = DATE_RE.search(text or "")
    if not m:
        return None
    dd, mm, yyyy = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return datetime(yyyy, mm, dd).date()
    except ValueError:
        return None


def detect_document_expiration_date(lines: List[str]) -> Optional[date]:
    keyed_candidates: List[date] = []

    for i, line in enumerate(lines):
        upper = normalize_upper(line)
        line_date = _parse_ddmmyyyy(line)

        has_expiry_keyword = any(k in upper for k in ("VENC", "VENCE", "VIGENCIA", "CADUC"))

        if has_expiry_keyword:
            if line_date:
                keyed_candidates.append(line_date)
            if i + 1 < len(lines):
                next_date = _parse_ddmmyyyy(lines[i + 1])
                if next_date:
                    keyed_candidates.append(next_date)

    if keyed_candidates:
        return max(keyed_candidates)

    return None


def is_valid_for_slot(expected_type: str, detected_type: str) -> Tuple[bool, str]:
    if not expected_type:
        return True, "No se envió expectedDocumentType; se omite validación de slot."

    exp = normalize_doc_type(expected_type)
    det = normalize_doc_type(detected_type)

    if exp == det:
        return True, f"Documento detectado ({det}) coincide con el esperado ({exp})."

    return False, f"Documento detectado ({det}) no coincide con el esperado ({exp})."


def lambda_handler(event, context):
    method = (event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod") or "").upper()
    if method == "OPTIONS":
        return safe_json_response(200, {"ok": True})

    try:
        data = parse_event_json(event)

        file_b64 = data.get("fileBase64") or data.get("frontImageBase64")
        file_name = str(data.get("fileName") or "")
        content_type = str(data.get("contentType") or "")

        expected_document_type = (
            data.get("expectedDocumentType")
            or data.get("slotExpected")
            or data.get("documentTypeExpected")
            or ""
        )

        if not file_b64:
            return safe_json_response(400, {"message": "fileBase64 es requerido"})

        file_bytes, mime_hint = parse_b64_payload(file_b64)
        file_kind = detect_file_kind(file_bytes, mime_hint, file_name, content_type)

        lines, confs = textract_lines(file_bytes, file_kind)
        joined = "\n".join(lines)

        detected_type = detect_document_type(joined)

        if detected_type == "CEDULA":
            extracted = extract_identity_from_cedula(lines, joined)
            extraction_performed = True
        elif detected_type == "RIF":
            extracted = extract_identity_from_rif(lines, joined)
            extraction_performed = True
        else:
            extracted = {
                "documentType": detected_type,
                "documentNumber": None,
                "givenNames": None,
                "surnames": None,
                "companyName": None,
            }
            extraction_performed = False

        slot_ok, slot_reason = is_valid_for_slot(expected_document_type, detected_type)

        warnings: List[str] = []
        avg_conf = (sum(confs) / len(confs) / 100.0) if confs else 0.0

        if extraction_performed:
            if not extracted.get("documentNumber"):
                warnings.append("No se pudo extraer número de documento con confianza.")
            if detected_type == "CEDULA":
                if not extracted.get("givenNames"):
                    warnings.append("No se pudieron extraer nombres con confianza.")
                if not extracted.get("surnames"):
                    warnings.append("No se pudieron extraer apellidos con confianza.")
            if detected_type == "RIF":
                if not extracted.get("companyName"):
                    warnings.append("No se pudo extraer razón social con confianza.")

        if detected_type in ("RIF", "CEDULA"):
            expiry = detect_document_expiration_date(lines)
            if expiry:
                today = date.today()
                days_left = (expiry - today).days
                doc_label = "RIF" if detected_type == "RIF" else "Cédula"
                if days_left < 0:
                    warnings.append(f"{doc_label} vencido (venció el {expiry.strftime('%d/%m/%Y')}).")
                elif days_left <= 183:
                    warnings.append(f"{doc_label} próximo a vencer (vence el {expiry.strftime('%d/%m/%Y')}, en {days_left} días).")

        if avg_conf < 0.70:
            warnings.append("OCR con baja confianza general.")

        fields = {
            "documentType": extracted.get("documentType") or "",
            "documentNumber": extracted.get("documentNumber") or "",
            "givenNames": extracted.get("givenNames") or "",
            "surnames": extracted.get("surnames") or "",
            "companyName": extracted.get("companyName") or "",
            "nombres": extracted.get("givenNames") or "",
            "apellidos": extracted.get("surnames") or "",
            "cedula": extracted.get("documentNumber") or "",
            "rif": extracted.get("documentNumber") or "",
        }

        confidence = {
            "documentNumber": 0.90 if fields["documentNumber"] else 0.25,
            "givenNames": 0.85 if fields["givenNames"] else 0.25,
            "surnames": 0.85 if fields["surnames"] else 0.25,
            "companyName": 0.85 if fields["companyName"] else 0.25,
            "ocrAverage": round(avg_conf, 3),
        }

        return safe_json_response(
            200,
            {
                "expectedDocumentType": normalize_doc_type(expected_document_type) if expected_document_type else "",
                "documentTypeDetected": normalize_doc_type(detected_type),
                "isValidForSlot": slot_ok,
                "slotValidationReason": slot_reason,
                "fileKindDetected": file_kind,
                "isExtractionPerformed": extraction_performed,
                "fields": fields,
                "confidence": confidence,
                "warnings": warnings,
            },
        )

    except Exception as exc:
        return safe_json_response(500, {"message": "Error procesando documento", "error": str(exc)})
