# Local OMR Server

## Setup
```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
```

## Expose via ngrok
```bash
ngrok http 8000
```
