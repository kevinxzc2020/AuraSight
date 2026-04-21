# AuraSight — YOLOv8 Model Training

## Quick Start

1. Open `AuraSight_YOLOv8_Training.ipynb` in Google Colab
2. Set runtime to GPU (T4 or better)
3. Fill in your Roboflow API key and workspace
4. Run all cells

## Before Training

**⚠️ Fix your labels first.** The V1.2 dataset has known issues:
- Nodule class is over-represented (41% vs clinical reality of <10%)
- Many papules were mislabeled as nodules
- This means any model trained on this data will learn wrong semantics

The notebook includes a label distribution check (Step 3) that will warn you if the distribution looks wrong.

## After Training

1. Download the `.onnx` file from the notebook
2. Place it in the backend: `AuraSight-api/models/acne_v2.onnx`
3. Set env var: `YOLO_MODEL_PATH=./models/acne_v2.onnx`
4. Restart the backend — it will auto-load the model

The backend already has `detectWithYolo()` wired up and ready.

## Integration Architecture

```
Camera → Base64 image
  ├── Claude Vision (dual-pass, self-consistency) → text analysis + detections
  └── YOLOv8 ONNX (when available) → fast bounding boxes
      → Merge/validate both → Final detections
```

## Files

- `AuraSight_YOLOv8_Training.ipynb` — Colab training notebook
- `../AuraSight-api/src/index.js` — `detectWithYolo()` inference helper (already integrated)
