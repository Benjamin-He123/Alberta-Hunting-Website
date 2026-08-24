import pdfplumber
import json

def extract_all_regulation_tables(pdf_path):
    regulation = []

    valid_headers = [
        ['Species', 'Type', 'SEASON', None, 'WMUs'],
        ['Black Bear\nSeason', 'SEASON', None, 'WMUs']
    ]

    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for table in tables:
                if table and table[0] in valid_headers:
                    regulation.append({
                        "page": page_number,
                        "table": table
                    })

    return regulation

if __name__ == "__main__":
    pdf_path = "data/regulations/fp-alberta-guide-to-hunting-regulations-2026.pdf"
    regulation = extract_all_regulation_tables(pdf_path)

    print(f"Found {len(regulation)} matching tables")

    with open("data/regulations/regulation_tables.json", "w") as f:
        json.dump(regulation, f, indent=2)