FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire package
COPY . .

# Persistent DB lives in /data volume on Railway
ENV DB_PATH=/data/analyst_desk.db

CMD ["python", "main.py"]
