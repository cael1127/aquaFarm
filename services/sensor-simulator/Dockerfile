FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir httpx==0.28.1
COPY simulator.py .
CMD ["python", "simulator.py"]
