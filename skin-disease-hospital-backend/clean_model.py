import zipfile
import json
import os
import shutil

def clean_keras_config(zip_path, output_path):
    print(f"Cleaning model config for {zip_path} -> {output_path}...")
    temp_dir = "temp_keras_unzip"
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)

    # Extract all files
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)

    config_file = os.path.join(temp_dir, "config.json")
    if not os.path.exists(config_file):
        print("config.json not found in keras file!")
        return False

    with open(config_file, 'r') as f:
        config_data = json.load(f)

    # Recursive function to clean dictionaries
    def clean_dict(d):
        if isinstance(d, dict):
            # Remove keys that cause deserialization errors
            keys_to_remove = ["quantization_config", "optional"]
            for k in keys_to_remove:
                if k in d:
                    print(f"Removing key: {k} (value: {d[k]})")
                    del d[k]
            # Recursively clean children
            for k, v in d.items():
                clean_dict(v)
        elif isinstance(d, list):
            for item in d:
                clean_dict(item)

    clean_dict(config_data)

    # Save cleaned config
    with open(config_file, 'w') as f:
        json.dump(config_data, f)

    # Zip back
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zip_out:
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arc_name = os.path.relpath(file_path, temp_dir)
                zip_out.write(file_path, arc_name)

    # Clean up temp
    shutil.rmtree(temp_dir)
    print("Done cleaning model config!")
    return True

if __name__ == "__main__":
    model_src = "/home/darkwing/Desktop/Pf/model_resnet50_klasifikasi.keras"
    model_dst = "/home/darkwing/Desktop/Pf/skin-disease-hospital-backend/data/models/model_v1.keras"
    
    # Clean it directly to the target path
    clean_keras_config(model_src, model_dst)
