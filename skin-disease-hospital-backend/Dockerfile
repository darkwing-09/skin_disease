FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 libpq-dev gcc \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data/images /app/data/reports \
             /app/data/feedback_ds /app/data/models

COPY model_resnet50_klasifikasi.keras /app/data/models/model_v1.keras
RUN echo "v1" > /app/data/models/active_version.txt

RUN chmod +x /app/start.sh && chmod -R 777 /app/data

EXPOSE 7860

CMD ["./start.sh"]
