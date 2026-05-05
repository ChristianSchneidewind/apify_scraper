FROM apify/actor-python-playwright-chrome:latest

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

CMD ["python", "-m", "main"]
