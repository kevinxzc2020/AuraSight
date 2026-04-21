"""
AuraSight — 多数据集合并 + 类别重映射脚本

合并你的 V1.2 数据集 + 外部 12 类数据集 → 统一的 4 类数据集:
  0: comedone
  1: papule
  2: pustule
  3: nodule

方案 A（保守）：外部数据集中只保留靠谱的映射:
  Blackhead → comedone, Whitehead → comedone
  Papular → papule, Purulent → pustule
  Conglobata → nodule, Cystic → nodule
  Milium → comedone (外观像白头)
  Folliculitis → pustule (外观像脓疱)
  其余丢弃 (Flat_wart, Keloid, Scars, Syringoma)

用法:
  python remap_labels.py \
    --v1 ./Acne-Detection-V1-2 \
    --external ./acne-6rzah-1 \
    --output ./merged

然后在 Colab 训练时指向 merged/ 文件夹即可。
"""

import os
import shutil
import argparse
from pathlib import Path
from collections import Counter

TARGET_NAMES = ["comedone", "papule", "pustule", "nodule"]

# ── 外部 12 类数据集的映射规则 ──
# 源 class id → 目标 class id (-1 = 丢弃)
EXTERNAL_MAP = {
    0: 0,    # Blackhead → comedone
    1: 3,    # Conglobata → nodule
    2: 3,    # Cystic → nodule
    3: -1,   # Flat_wart → skip
    4: 2,    # Folliculitis → pustule (保守方案 A: 外观像脓疱)
    5: -1,   # Keloid → skip
    6: 0,    # Milium → comedone (保守方案 A: 外观像白头)
    7: 1,    # Papular → papule
    8: 2,    # Purulent → pustule
    9: -1,   # Scars → skip
    10: -1,  # Syringoma → skip
    11: 0,   # Whitehead → comedone
}

EXTERNAL_NAMES = [
    "Blackhead", "Conglobata", "Cystic", "Flat_wart", "Folliculitis",
    "Keloid", "Milium", "Papular", "Purulent", "Scars", "Syringoma", "Whitehead",
]


def find_image(img_dir: Path, stem: str):
    """找到标注文件对应的图片（可能是 jpg/png/jpeg 等）"""
    for ext in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]:
        p = img_dir / (stem + ext)
        if p.exists():
            return p
    return None


def copy_v1_split(v1_dir: Path, output_dir: Path, split: str, prefix: str = "v1_"):
    """
    复制 V1.2 数据集的一个 split。
    V1.2 的类已经是 [comedone, papule, pustule, nodule]，class id 不需要改。
    给文件名加前缀避免和外部数据集重名。
    """
    img_in = v1_dir / split / "images"
    lbl_in = v1_dir / split / "labels"

    if not img_in.exists():
        print(f"    ⏭  V1.2 {split}/ not found, skipping")
        return 0, Counter()

    img_out = output_dir / split / "images"
    lbl_out = output_dir / split / "labels"
    img_out.mkdir(parents=True, exist_ok=True)
    lbl_out.mkdir(parents=True, exist_ok=True)

    count = 0
    cls_counts = Counter()

    for lbl_file in sorted(lbl_in.glob("*.txt")):
        stem = lbl_file.stem
        img_path = find_image(img_in, stem)
        if not img_path:
            continue

        # 读标注，统计类别
        with open(lbl_file) as f:
            lines = [l.strip() for l in f if l.strip() and len(l.strip().split()) >= 5]
        if not lines:
            continue

        for line in lines:
            cls_id = int(line.split()[0])
            if cls_id < len(TARGET_NAMES):
                cls_counts[TARGET_NAMES[cls_id]] += 1

        # 加前缀复制
        new_name = prefix + stem
        shutil.copy2(img_path, img_out / (new_name + img_path.suffix))
        with open(lbl_out / (new_name + ".txt"), "w") as f:
            f.write("\n".join(lines) + "\n")
        count += 1

    return count, cls_counts


def remap_external_split(ext_dir: Path, output_dir: Path, split: str, prefix: str = "ext_"):
    """
    复制外部 12 类数据集的一个 split，同时重映射 class id。
    不可映射的类会被丢弃；如果一张图的标注全被丢弃，图也跳过。
    """
    img_in = ext_dir / split / "images"
    lbl_in = ext_dir / split / "labels"

    if not img_in.exists():
        print(f"    ⏭  External {split}/ not found, skipping")
        return 0, 0, Counter()

    img_out = output_dir / split / "images"
    lbl_out = output_dir / split / "labels"
    img_out.mkdir(parents=True, exist_ok=True)
    lbl_out.mkdir(parents=True, exist_ok=True)

    kept_images = 0
    skipped_boxes = 0
    cls_counts = Counter()

    for lbl_file in sorted(lbl_in.glob("*.txt")):
        new_lines = []
        with open(lbl_file) as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) < 5:
                    continue
                old_cls = int(parts[0])
                new_cls = EXTERNAL_MAP.get(old_cls, -1)
                if new_cls == -1:
                    skipped_boxes += 1
                    continue
                parts[0] = str(new_cls)
                new_lines.append(" ".join(parts))
                cls_counts[TARGET_NAMES[new_cls]] += 1

        if not new_lines:
            continue

        stem = lbl_file.stem
        img_path = find_image(img_in, stem)
        if not img_path:
            continue

        new_name = prefix + stem
        shutil.copy2(img_path, img_out / (new_name + img_path.suffix))
        with open(lbl_out / (new_name + ".txt"), "w") as f:
            f.write("\n".join(new_lines) + "\n")
        kept_images += 1

    return kept_images, skipped_boxes, cls_counts


def main():
    parser = argparse.ArgumentParser(
        description="Merge AuraSight V1.2 + external 12-class dataset → unified 4-class dataset"
    )
    parser.add_argument("--v1", required=True, help="Path to your V1.2 dataset (Acne-Detection-V1-2/)")
    parser.add_argument("--external", required=True, help="Path to downloaded 12-class dataset (acne-6rzah-1/)")
    parser.add_argument("--output", default="./merged", help="Output folder for merged dataset")
    args = parser.parse_args()

    v1_dir = Path(args.v1)
    ext_dir = Path(args.external)
    output_dir = Path(args.output)

    if output_dir.exists():
        print(f"⚠️  Output folder {output_dir} already exists. Remove it first or choose a different path.")
        return

    kept_classes = [EXTERNAL_NAMES[i] for i, v in EXTERNAL_MAP.items() if v >= 0]
    dropped_classes = [EXTERNAL_NAMES[i] for i, v in EXTERNAL_MAP.items() if v == -1]

    print(f"\n{'='*60}")
    print(f"  AuraSight Dataset Merger")
    print(f"{'='*60}")
    print(f"  V1.2 dataset:     {v1_dir}")
    print(f"  External dataset: {ext_dir}")
    print(f"  Output:           {output_dir}")
    print(f"  Target classes:   {TARGET_NAMES}")
    print(f"  External kept:    {', '.join(kept_classes)}")
    print(f"  External dropped: {', '.join(dropped_classes)}")
    print()

    total_cls = Counter()

    for split in ["train", "valid", "test"]:
        print(f"  ── {split} ──")

        # V1.2
        v1_count, v1_cls = copy_v1_split(v1_dir, output_dir, split)
        print(f"    V1.2:     {v1_count} images")

        # External
        ext_count, ext_skipped, ext_cls = remap_external_split(ext_dir, output_dir, split)
        print(f"    External: {ext_count} images ({ext_skipped} boxes dropped)")

        merged = v1_count + ext_count
        print(f"    Merged:   {merged} images total")

        for k, v in v1_cls.items():
            total_cls[k] += v
        for k, v in ext_cls.items():
            total_cls[k] += v

    # data.yaml
    yaml_content = f"""train: ../train/images
val: ../valid/images
test: ../test/images

nc: {len(TARGET_NAMES)}
names: {TARGET_NAMES}
"""
    with open(output_dir / "data.yaml", "w") as f:
        f.write(yaml_content)

    # 最终统计
    total_boxes = sum(total_cls.values())
    print(f"\n{'='*60}")
    print(f"  ✅ Merge complete!")
    print(f"{'='*60}")
    print(f"  Total boxes: {total_boxes}")
    print()
    print(f"  Class distribution:")
    for name in TARGET_NAMES:
        c = total_cls.get(name, 0)
        pct = c / total_boxes * 100 if total_boxes > 0 else 0
        bar = "█" * int(pct / 2)
        print(f"    {name:12s}: {c:6d} ({pct:5.1f}%) {bar}")

    # 分布健康检查
    if total_boxes > 0:
        nodule_pct = total_cls.get("nodule", 0) / total_boxes * 100
        if nodule_pct > 25:
            print(f"\n  ⚠️  WARNING: nodule 占比 {nodule_pct:.0f}% 仍然偏高！")
            print(f"     临床上 nodule 应该 <10%。请在 Roboflow 里检查标注。")
        else:
            print(f"\n  ✅ 类别分布看起来比之前合理")

    print(f"\n  Output: {output_dir}/")
    print(f"  data.yaml: {output_dir / 'data.yaml'}")
    print(f"\n  下一步:")
    print(f"    1. 抽查几张图确认标注质量")
    print(f"    2. 在 Colab notebook 里把 dataset path 指向 {output_dir}/")
    print(f"       或上传到 Roboflow 生成新 version")


if __name__ == "__main__":
    main()
