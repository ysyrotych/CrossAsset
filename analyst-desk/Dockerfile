FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire package
COPY . .

# DB lives in the working directory (writable on Render)
ENV DB_PATH=/app/analyst_desk.db

CMD ["python", "main.py"]
