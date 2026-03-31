import base64
import json
import os
import re
import unicodedata
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

import boto3

# Mantengo tus variables actuales aunque esta versión no use Textract/S3
DOCUMENT_OCR_BUCKET = os.getenv("DOCUMENT_OCR_BUCKET", "").strip()
DOCUMENT_OCR_POLL_SECONDS = float(os.getenv("DOCUMENT_OCR_POLL_SECONDS", "1.5"))
DOCUMENT_OCR_MAX_WAIT_SECONDS = int(os.getenv("DOCUMENT_OCR_MAX_WAIT_SECONDS", "180"))

BEDROCK_REGION = os.getenv("BEDROCK_REGION") or os.getenv("AWS_REGION") or "us-east-1"
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "").strip()
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))

bedrock = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)

RESPONSE_HEADERS = {
    "Content-Type": "application/json"
}

ACCEPTED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp"}
ACCEPTED_DOC_MIME = {"application/pdf", "image/jpeg", "image/png", "image/webp"}

DATE_FULL_RE = re.compile(r"\b(\d{2})[/-](\d{2})[/-](\d{4})\b")
DATE_MONTH_YEAR_RE = re.compile(r"\b(\d{2})[/-](\d{4})\b")


# =========================
# Helpers generales
# =========================

def safe_json_response(status_code: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": RESPONSE_HEADERS,
        "body": json.dumps(payload, ensure_ascii=False),
    }


def normalize_upper(value: str) -> str:
    no_acc = "".join(
        c for c in unicodedata.normalize("NFD", value or "")
        if unicodedata.category(c) != "Mn"
    )
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
        "OTRO": "OTRO",
    }
    return aliases.get(v, "OTRO" if v else "")


def normalize_requested_category(value: str) -> str:
    v = normalize_upper(value or "")
    aliases = {
        "FACHADA": "FACHADA",
        "INTERIOR": "INTERIOR",
        "INTERIOR_DE_NEGOCIO": "INTERIOR",
        "INVENTARIO": "INVENTARIO",
        "INVENTARIO_DE_NEGOCIO": "INVENTARIO",
    }
    return aliases.get(v, v)


def parse_event_json(event: Dict[str, Any]) -> Dict[str, Any]:
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


def detect_mime(mime_hint: str = "", content_type: str = "", file_name: str = "") -> str:
    mh = (mime_hint or content_type or "").lower().strip()
    fn = (file_name or "").lower().strip()

    if mh:
        return mh
    if fn.endswith(".pdf"):
        return "application/pdf"
    if fn.endswith(".jpg") or fn.endswith(".jpeg"):
        return "image/jpeg"
    if fn.endswith(".png"):
        return "image/png"
    if fn.endswith(".webp"):
        return "image/webp"
    return ""


def mime_to_image_format(mime: str) -> str:
    if mime == "image/png":
        return "png"
    if mime == "image/webp":
        return "webp"
    return "jpeg"


def document_format_from_mime(mime: str, file_name: str) -> str:
    if mime == "application/pdf" or (file_name or "").lower().endswith(".pdf"):
        return "pdf"
    if mime == "image/png":
        return "png"
    if mime == "image/webp":
        return "webp"
    return "jpeg"


def parse_json_from_text(text: str) -> Dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("La respuesta del modelo no contiene JSON válido.")
    return json.loads(text[start:end + 1])


def dedupe_list(items: List[str]) -> List[str]:
    out: List[str] = []
    seen = set()
    for item in items:
        value = (item or "").strip()
        if not value:
            continue
        if value not in seen:
            out.append(value)
            seen.add(value)
    return out


def clean_text_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _parse_expiry_date(text: str) -> Optional[date]:
    value = clean_text_value(text)

    m = DATE_FULL_RE.search(value)
    if m:
        dd, mm, yyyy = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(yyyy, mm, dd).date()
        except ValueError:
            return None

    m2 = DATE_MONTH_YEAR_RE.search(value)
    if m2:
        mm, yyyy = int(m2.group(1)), int(m2.group(2))
        try:
            # usar el primer día del mes como referencia mínima
            return datetime(yyyy, mm, 1).date()
        except ValueError:
            return None

    return None


# =========================
# Bedrock
# =========================

def invoke_bedrock(
    user_content: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not BEDROCK_MODEL_ID:
        raise RuntimeError("BEDROCK_MODEL_ID no configurado.")

    response = bedrock.converse(
        modelId=BEDROCK_MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": user_content
            }
        ],
        inferenceConfig={
            "maxTokens": 1600,
            "temperature": 0,
            "topP": 1
        },
        additionalModelRequestFields={
            "top_k": 250
        }
    )

    content = response.get("output", {}).get("message", {}).get("content", [])
    model_text = "".join(item.get("text", "") for item in content if "text" in item)
    return parse_json_from_text(model_text)


# =========================
# Prompts
# =========================

def build_document_prompt(expected_document_type: str) -> str:
    expected = normalize_doc_type(expected_document_type or "")

    return f"""
Eres un sistema de validación documental y extracción de campos para onboarding de comercios en Venezuela.

Analiza UN documento y responde SOLO JSON válido.
No agregues texto fuera del JSON.
No inventes ningún dato.
Si un campo no se ve con suficiente claridad, devuélvelo vacío.

TIPOS DOCUMENTALES PERMITIDOS:
- CEDULA
- RIF
- ACTA_CONSTITUTIVA
- OTRO

REGLAS:
- expectedDocumentType = "{expected}"
- Debes detectar el tipo documental real en documentTypeDetected.
- REGISTRO MERCANTIL debe tratarse como ACTA_CONSTITUTIVA.
- Si no coincide con el slot esperado, isValidForSlot debe ser false.
- No inventes campos del formulario.
- Solo llena campos que realmente se vean.
- Para CEDULA:
  - nombres
  - apellidos
  - numeroIdentificacion
  - fechaVencimiento
- Para RIF:
  - numeroIdentificacion
  - fechaVencimiento
  - razonSocial
- Para ACTA_CONSTITUTIVA:
  - no rellenes campos del formulario
- fieldStatus por campo debe ser:
  - detected
  - not_detected
  - not_applicable

RESPONDE SOLO ESTE JSON:
{{
  "documentTypeDetected": "CEDULA | RIF | ACTA_CONSTITUTIVA | OTRO",
  "isValidForSlot": true,
  "slotValidationReason": "string",
  "ocrTextPreview": "resumen breve del texto relevante visible, máximo 12 líneas o menos",
  "fields": {{
    "nombres": "",
    "apellidos": "",
    "numeroIdentificacion": "",
    "fechaVencimiento": "",
    "razonSocial": ""
  }},
  "fieldStatus": {{
    "nombres": "detected | not_detected | not_applicable",
    "apellidos": "detected | not_detected | not_applicable",
    "numeroIdentificacion": "detected | not_detected | not_applicable",
    "fechaVencimiento": "detected | not_detected | not_applicable",
    "razonSocial": "detected | not_detected | not_applicable"
  }},
  "warnings": []
}}
""".strip()


def build_business_image_prompt(requested_category: str) -> str:
    requested = normalize_requested_category(requested_category or "")

    return f"""
Eres un sistema de validación visual para onboarding de comercios.

Analiza UNA imagen y responde SOLO JSON válido.
No agregues texto fuera del JSON.

La categoría solicitada es:
- "{requested}"

CATEGORÍAS VISUALES POSIBLES:
- FACHADA
- INTERIOR
- INVENTARIO
- PERSONA
- NO_CLASIFICADA

REGLAS:
- Describe solo lo que realmente ves.
- No inventes contexto comercial si no es visible.
- Si aparece una persona/selfie como elemento principal y no corresponde al tipo solicitado, eso debe reflejarse como NO_COINCIDE.
- Si la imagen corresponde claramente a la categoría solicitada:
  validationResult = "VALIDADA"
- Si no corresponde:
  validationResult = "NO_COINCIDE"
- Si es ambigua o poco clara:
  validationResult = "REVISAR"

RESPONDE SOLO ESTE JSON:
{{
  "validationResult": "VALIDADA | REVISAR | NO_COINCIDE",
  "description": "string",
  "categoryProbability": 0,
  "mismatchReason": "PERSONA_DETECTADA | OTRA_CATEGORIA | IMAGEN_AMBIGUA | CALIDAD_BAJA | CONTENIDO_IRRELEVANTE | null",
  "warnings": []
}}
""".strip()


# =========================
# Normalización documentos
# =========================

def normalize_field_status(raw_status: Any, detected_type: str, key: str, value: str) -> str:
    normalized = normalize_upper(str(raw_status or "")).replace(" ", "_")
    if normalized in {"DETECTED", "NOT_DETECTED", "NOT_APPLICABLE"}:
        normalized = normalized.lower()
        if normalized == "detected" and not value:
            return "not_detected"
        return normalized

    applicability = {
        "CEDULA": {
            "nombres": True,
            "apellidos": True,
            "numeroIdentificacion": True,
            "fechaVencimiento": True,
            "razonSocial": False,
        },
        "RIF": {
            "nombres": False,
            "apellidos": False,
            "numeroIdentificacion": True,
            "fechaVencimiento": True,
            "razonSocial": True,
        },
        "ACTA_CONSTITUTIVA": {
            "nombres": False,
            "apellidos": False,
            "numeroIdentificacion": False,
            "fechaVencimiento": False,
            "razonSocial": False,
        },
        "OTRO": {
            "nombres": False,
            "apellidos": False,
            "numeroIdentificacion": False,
            "fechaVencimiento": False,
            "razonSocial": False,
        },
    }

    is_applicable = applicability.get(detected_type, applicability["OTRO"]).get(key, False)
    if not is_applicable:
        return "not_applicable"
    return "detected" if value else "not_detected"


def normalize_document_response(
    model_output: Dict[str, Any],
    expected_document_type: str,
    file_kind: str,
) -> Dict[str, Any]:
    detected_type = normalize_doc_type(model_output.get("documentTypeDetected") or "OTRO")
    expected_type = normalize_doc_type(expected_document_type or "")

    raw_fields = model_output.get("fields") or {}
    fields = {
        "nombres": clean_text_value(raw_fields.get("nombres")),
        "apellidos": clean_text_value(raw_fields.get("apellidos")),
        "numeroIdentificacion": clean_text_value(raw_fields.get("numeroIdentificacion")),
        "fechaVencimiento": clean_text_value(raw_fields.get("fechaVencimiento")),
        "razonSocial": clean_text_value(raw_fields.get("razonSocial")),
    }

    raw_field_status = model_output.get("fieldStatus") or {}
    field_status = {
        key: normalize_field_status(raw_field_status.get(key), detected_type, key, fields[key])
        for key in fields.keys()
    }

    warnings = dedupe_list(model_output.get("warnings") if isinstance(model_output.get("warnings"), list) else [])
    ocr_preview = clean_text_value(model_output.get("ocrTextPreview"))

    # validación por slot: el backend manda, pero aquí se refuerza para no depender ciegamente del modelo
    if expected_type:
        is_valid_for_slot = detected_type == expected_type
        if is_valid_for_slot:
            slot_reason = f"Documento detectado ({detected_type}) coincide con el esperado ({expected_type})."
        else:
            label = {
                "CEDULA": "una cédula",
                "RIF": "un RIF",
                "ACTA_CONSTITUTIVA": "un acta constitutiva / registro mercantil",
            }.get(expected_type, expected_type)
            slot_reason = f"El archivo cargado no corresponde a {label}."
    else:
        is_valid_for_slot = bool(model_output.get("isValidForSlot", True))
        slot_reason = clean_text_value(model_output.get("slotValidationReason")) or "No se envió expectedDocumentType; se omite validación de slot."

    expiry_alert = False
    expiry_str = fields["fechaVencimiento"]
    if expiry_str and detected_type in {"CEDULA", "RIF"}:
        expiry_date = _parse_expiry_date(expiry_str)
        if expiry_date:
            days_left = (expiry_date - date.today()).days
            doc_label = "RIF" if detected_type == "RIF" else "Cédula"
            if days_left < 0:
                warnings.append(f"{doc_label} vencido (venció el {expiry_date.strftime('%d/%m/%Y')}).")
                expiry_alert = True
            elif days_left <= 183:
                warnings.append(f"{doc_label} próximo a vencer (vence el {expiry_date.strftime('%d/%m/%Y')}, en {days_left} días).")
                expiry_alert = True

    warnings = dedupe_list(warnings)

    response = {
        "expectedDocumentType": expected_type,
        "documentTypeDetected": detected_type,
        "isValidForSlot": is_valid_for_slot,
        "slotValidationReason": slot_reason,
        "fileKindDetected": file_kind,
        "isExtractionPerformed": detected_type in {"CEDULA", "RIF"},
        "fields": fields,
        "fieldStatus": field_status,
        "warnings": warnings,
        "expiryAlert": expiry_alert,
        "ocrTextPreview": ocr_preview,
    }

    # compatibilidad temporal con el frontend actual
    response["legacyFields"] = {
        "documentType": detected_type,
        "documentNumber": fields["numeroIdentificacion"],
        "numeroIdentificacion": fields["numeroIdentificacion"],
        "givenNames": fields["nombres"],
        "surnames": fields["apellidos"],
        "nombres": fields["nombres"],
        "apellidos": fields["apellidos"],
        "companyName": fields["razonSocial"],
        "razonSocial": fields["razonSocial"],
        "fechaVencimiento": fields["fechaVencimiento"],
        "cedula": fields["numeroIdentificacion"] if detected_type == "CEDULA" else "",
        "rif": fields["numeroIdentificacion"] if detected_type == "RIF" else "",
    }

    response["confidence"] = {
        "nombres": 0.85 if fields["nombres"] else 0.25,
        "apellidos": 0.85 if fields["apellidos"] else 0.25,
        "numeroIdentificacion": 0.9 if fields["numeroIdentificacion"] else 0.25,
        "fechaVencimiento": 0.85 if fields["fechaVencimiento"] else 0.25,
        "razonSocial": 0.85 if fields["razonSocial"] else 0.25,
        "ocrAverage": 0.0,
    }

    return response


# =========================
# Normalización imágenes
# =========================

def normalize_business_image_response(
    model_output: Dict[str, Any],
    requested_category: str,
) -> Dict[str, Any]:
    validation_result = normalize_upper(model_output.get("validationResult") or "REVISAR")
    if validation_result not in {"VALIDADA", "REVISAR", "NO_COINCIDE"}:
        validation_result = "REVISAR"

    description = clean_text_value(model_output.get("description"))
    mismatch_reason = clean_text_value(model_output.get("mismatchReason")) or None
    warnings = dedupe_list(model_output.get("warnings") if isinstance(model_output.get("warnings"), list) else [])

    probability = model_output.get("categoryProbability")
    try:
        category_probability = int(float(probability))
    except Exception:
        category_probability = 0

    category_probability = max(0, min(100, category_probability))

    return {
        "requestedCategory": normalize_requested_category(requested_category),
        "validationResult": validation_result,
        "description": description,
        "categoryProbability": category_probability,
        "mismatchReason": mismatch_reason,
        "warnings": warnings,
    }


# =========================
# Handlers lógicos
# =========================

def build_document_user_content(prompt: str, file_bytes: bytes, mime: str, file_name: str) -> List[Dict[str, Any]]:
    content: List[Dict[str, Any]] = [{"text": prompt}]

    if mime == "application/pdf":
        content.append(
            {
                "document": {
                    "format": "pdf",
                    "name": (file_name or "documento.pdf")[:200],
                    "source": {"bytes": file_bytes}
                }
            }
        )
    else:
        content.append(
            {
                "image": {
                    "format": mime_to_image_format(mime),
                    "source": {"bytes": file_bytes}
                }
            }
        )

    return content


def handle_document_validation(data: Dict[str, Any]) -> Dict[str, Any]:
    file_b64 = data.get("fileBase64") or data.get("frontImageBase64")
    file_name = str(data.get("fileName") or "documento")
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
    mime = detect_mime(mime_hint, content_type, file_name)

    if mime not in ACCEPTED_DOC_MIME:
        return safe_json_response(
            400,
            {"message": "Formato no soportado. Usa PDF, JPG, PNG o WEBP."}
        )

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        return safe_json_response(413, {"message": "El archivo supera el tamaño permitido."})

    prompt = build_document_prompt(expected_document_type)
    user_content = build_document_user_content(prompt, file_bytes, mime, file_name)
    model_output = invoke_bedrock(user_content)
    normalized = normalize_document_response(
        model_output=model_output,
        expected_document_type=expected_document_type,
        file_kind="pdf" if mime == "application/pdf" else "image",
    )
    return safe_json_response(200, normalized)


def handle_business_image_validation(data: Dict[str, Any]) -> Dict[str, Any]:
    image_b64 = data.get("imageBase64") or data.get("fileBase64") or data.get("frontImageBase64")
    file_name = str(data.get("fileName") or "imagen")
    content_type = str(data.get("contentType") or "")
    requested_category = str(data.get("requestedCategory") or "")

    if not requested_category:
        return safe_json_response(400, {"message": "requestedCategory es requerido"})

    if not image_b64:
        return safe_json_response(400, {"message": "imageBase64 o fileBase64 es requerido"})

    file_bytes, mime_hint = parse_b64_payload(image_b64)
    mime = detect_mime(mime_hint, content_type, file_name)

    if mime not in ACCEPTED_IMAGE_MIME:
        return safe_json_response(
            400,
            {"message": "Para validación de imágenes usa JPG, PNG o WEBP."}
        )

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        return safe_json_response(413, {"message": "La imagen supera el tamaño permitido."})

    prompt = build_business_image_prompt(requested_category)
    user_content = [
        {"text": prompt},
        {
            "image": {
                "format": mime_to_image_format(mime),
                "source": {"bytes": file_bytes}
            }
        }
    ]

    model_output = invoke_bedrock(user_content)
    normalized = normalize_business_image_response(model_output, requested_category)
    return safe_json_response(200, normalized)


# =========================
# Lambda handler principal
# =========================

def lambda_handler(event, context):
    method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or ""
    ).upper()

    if method == "OPTIONS":
        return safe_json_response(200, {"ok": True})

    try:
        data = parse_event_json(event)

        # Validación de imágenes de negocio
        if data.get("requestedCategory"):
            return handle_business_image_validation(data)

        # Validación documental
        if data.get("expectedDocumentType") or data.get("slotExpected") or data.get("documentTypeExpected"):
            return handle_document_validation(data)

        return safe_json_response(
            400,
            {
                "message": "No se pudo determinar el tipo de operación. Envía requestedCategory o expectedDocumentType."
            },
        )

    except Exception as exc:
        return safe_json_response(
            500,
            {
                "message": "Error procesando solicitud con Bedrock.",
                "error": str(exc),
            },
        )