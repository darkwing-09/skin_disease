import numpy as np
from PIL import Image
import tensorflow as tf
import io
import os
from config import get_settings

# Keras deserialization compatibility patch for different sub-versions
try:
    import keras.src.saving.serialization_lib as serialization_lib
    original_deserialize = serialization_lib.deserialize_keras_object

    def safe_deserialize(config, *args, **kwargs):
        def clean_config(obj):
            if isinstance(obj, dict):
                obj.pop('quantization_config', None)
                for k, v in list(obj.items()):
                    clean_config(v)
            elif isinstance(obj, list):
                for item in obj:
                    clean_config(item)
        clean_config(config)
        return original_deserialize(config, *args, **kwargs)

    serialization_lib.deserialize_keras_object = safe_deserialize
except Exception as e:
    print(f"[MODEL] Keras deserialization patch failed to apply: {e}")

settings = get_settings()

CLASS_NAMES = [
    "Eczema",
    "Melanoma",
    "Atopic Dermatitis",
    "Basal Cell Carcinoma",
    "Melanocytic Nevi",
    "BKL (Benign Keratosis-like Lesions)",
    "Psoriasis / Lichen Planus",
    "Seborrheic Keratoses",
    "Tinea / Fungal Infection",
    "Warts / Viral Infection",
]

CLASS_METADATA = {
    "Eczema": {
        "description": "A chronic inflammatory skin condition causing dry, itchy, and inflamed patches.",
        "severity": "Moderate",
        "action": "Prescribe topical corticosteroids. Schedule follow-up in 2 weeks.",
        "icd_code": "L20.9",
    },
    "Melanoma": {
        "description": "A malignant tumor of melanocytes — the most dangerous form of skin cancer.",
        "severity": "Critical",
        "action": "URGENT: Refer to oncology immediately. Biopsy required within 48 hours.",
        "icd_code": "C43.9",
    },
    "Atopic Dermatitis": {
        "description": "A chronic form of eczema common in children, causing intense itching.",
        "severity": "Moderate",
        "action": "Prescribe emollients and mild topical steroids. Allergen panel recommended.",
        "icd_code": "L20.0",
    },
    "Basal Cell Carcinoma": {
        "description": "The most common skin cancer. Slow-growing and rarely spreads.",
        "severity": "High",
        "action": "Refer to dermatology for excision. Non-urgent but within 4 weeks.",
        "icd_code": "C44.91",
    },
    "Melanocytic Nevi": {
        "description": "Common benign moles. Monitor for ABCDE changes.",
        "severity": "Low",
        "action": "Document and monitor. ABCDE rule check. Annual follow-up.",
        "icd_code": "D22.9",
    },
    "BKL (Benign Keratosis-like Lesions)": {
        "description": "Non-cancerous surface growths. Cosmetically bothersome but harmless.",
        "severity": "Low",
        "action": "Reassure patient. Cryotherapy if cosmetically bothersome.",
        "icd_code": "L82.1",
    },
    "Psoriasis / Lichen Planus": {
        "description": "Chronic autoimmune skin conditions causing scaly, itchy plaques.",
        "severity": "Moderate",
        "action": "Topical vitamin D analogues + corticosteroids. Refer to rheumatology if systemic.",
        "icd_code": "L40.0",
    },
    "Seborrheic Keratoses": {
        "description": "Harmless, waxy age-related skin growths. Very common in adults over 50.",
        "severity": "Low",
        "action": "No treatment required. Reassure patient. Removal optional.",
        "icd_code": "L82.1",
    },
    "Tinea / Fungal Infection": {
        "description": "Fungal skin infections including ringworm, tinea pedis, and tinea corporis.",
        "severity": "Moderate",
        "action": "Prescribe topical antifungals (clotrimazole). Culture swab recommended.",
        "icd_code": "B35.9",
    },
    "Warts / Viral Infection": {
        "description": "HPV-caused skin growths. Common in children and immunocompromised patients.",
        "severity": "Low",
        "action": "Cryotherapy or salicylic acid. HPV vaccination if not received.",
        "icd_code": "B07.9",
    },
}

SEVERITY_REMAP = {
    "Critical": "Critical",
    "High":     "Severe",
    "Moderate": "Moderate",
    "Low":      "Mild",
}

_MODEL = None
_MODEL_VERSION = "v1"


def get_active_model_path() -> tuple[str, str]:
    marker = os.path.join(settings.MODELS_DIR, "active_version.txt")
    if os.path.exists(marker):
        with open(marker) as f:
            version = f.read().strip()
        path = os.path.join(settings.MODELS_DIR, f"model_{version}.keras")
        if os.path.exists(path):
            return path, version
    return settings.INITIAL_MODEL_PATH, "v1"


def load_model(force_reload: bool = False):
    global _MODEL, _MODEL_VERSION
    path, version = get_active_model_path()
    if _MODEL is None or force_reload or version != _MODEL_VERSION:
        print(f"[MODEL] Loading {version} from {path}")
        _MODEL = tf.keras.models.load_model(path)
        _MODEL_VERSION = version
        print(f"[MODEL] Loaded: {version}")
    return _MODEL, _MODEL_VERSION


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((settings.MODEL_INPUT_WIDTH, settings.MODEL_INPUT_HEIGHT))
    arr = np.asarray(img, dtype=np.float32)
    mean = arr.mean()
    std = arr.std() if arr.std() != 0 else 1.0
    arr = (arr - mean) / std
    return np.expand_dims(arr, axis=0)


def run_inference(image_bytes: bytes) -> dict:
    model, version = load_model()
    tensor = preprocess_image(image_bytes)
    probs = model.predict(tensor, verbose=0)[0]
    sorted_idx = np.argsort(probs)[::-1]
    top_idx = int(sorted_idx[0])
    top_label = CLASS_NAMES[top_idx]
    top_conf = float(probs[top_idx])
    meta = CLASS_METADATA[top_label]

    all_classes = [
        {"rank": i + 1, "label": CLASS_NAMES[idx], "confidence": round(float(probs[idx]) * 100, 2)}
        for i, idx in enumerate(sorted_idx)
    ]
    all_probs_dict = {CLASS_NAMES[i]: round(float(p) * 100, 4) for i, p in enumerate(probs)}

    return {
        "top_prediction":     top_label,
        "confidence":         round(top_conf * 100, 2),
        "description":        meta["description"],
        "severity":           SEVERITY_REMAP.get(meta["severity"], meta["severity"]),
        "recommended_action": meta["action"],
        "icd_code":           meta["icd_code"],
        "all_classes":        all_classes,
        "all_probabilities":  all_probs_dict,
        "model_version":      version,
    }
