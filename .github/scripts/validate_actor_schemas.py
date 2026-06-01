import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATASET_SCHEMA = ROOT / ".actor" / "dataset_schema.json"
OUTPUT_SCHEMA = ROOT / ".actor" / "output_schema.json"


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    dataset = load_json(DATASET_SCHEMA)
    output = load_json(OUTPUT_SCHEMA)

    required_dataset_keys = {"title", "schemaVersion", "type", "properties"}
    missing_dataset = required_dataset_keys - set(dataset.keys())
    if missing_dataset:
        raise SystemExit(f"dataset_schema.json missing keys: {sorted(missing_dataset)}")

    outputs = output.get("outputs")
    if not isinstance(outputs, list) or not outputs:
        raise SystemExit("output_schema.json must contain a non-empty 'outputs' array")

    dataset_ref = outputs[0].get("schema")
    if dataset_ref != "./dataset_schema.json":
        raise SystemExit("output_schema.json first output schema must reference './dataset_schema.json'")

    print("Schema validation passed")


if __name__ == "__main__":
    main()
