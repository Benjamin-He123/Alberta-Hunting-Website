import json
import csv
import re

MONTH_MAP = {
    "Ap": "Apr", "Ma": "May", "Ju": "Jun",
    "A": "Aug", "S": "Sep", "O": "Oct",
    "N": "Nov", "D": "Dec", "J": "Jan", "F": "Feb",
}
# Sorted longest-prefix-first so "Ap" isn't mistakenly matched as "A" + "p"
MONTH_PREFIXES = sorted(MONTH_MAP.keys(), key=len, reverse=True)

def decode_date_token(token):
    """Turns 'S1' into 'Sep 1', 'N30' into 'Nov 30', keeps trailing ', 2027' if present."""
    token = token.strip()
    match = re.match(r"^(Ap|Ma|Ju|A|S|O|N|D|J|F)(\d{1,2})(,\s*\d{4})?$", token)
    if not match:
        return token  # couldn't parse — leave as-is for manual review
    prefix, day, year = match.groups()
    month = MONTH_MAP[prefix]
    year_str = year.strip(", ") if year else ""
    return f"{month} {day}" + (f", {year_str}" if year_str else "")

def parse_season_ranges(cell_text):
    """
    A season cell can contain multiple date ranges, one per line, each
    optionally prefixed with a stray 'n' (unclear meaning in the source —
    possibly a PDF bullet-point artifact; stripped here).
    Returns a list of (start, end) tuples.
    """
    if not cell_text:
        return []

    ranges = []
    for line in cell_text.split("\n"):
        line = line.strip()
        line = re.sub(r"^n\s*", "", line)  # strip leading stray "n "
        if not line or "-" not in line:
            continue
        parts = [p.strip() for p in line.split("-", 1)]
        if len(parts) != 2:
            continue
        start = decode_date_token(parts[0])
        end = decode_date_token(parts[1])
        ranges.append((start, end))

    return ranges

def parse_wmu_list(wmu_text):
    """
    Splits a WMU cell into individual WMU numbers.
    Handles comma-separated lists and parenthetical groupings like
    '(200, 202, 203)'. Drops trailing notes in parentheses that aren't
    numeric groups, e.g. '116, 118, 119 (Monday to Saturday only)'.
    NOTE: does not attempt to detect/strip footnote superscripts stuck to
    numbers (e.g. '9361', '3024') — these need manual review against the
    PDF's footnote list.
    """
    if not wmu_text:
        return []

    # Remove trailing free-text notes like "(Monday to Saturday only)"
    cleaned = re.sub(r"\([^0-9,\s]+.*?\)", "", wmu_text)

    # Now split on commas, stripping any remaining parentheses
    tokens = re.split(r",\s*", cleaned)
    wmus = []
    for t in tokens:
        t = t.strip("() ").strip()
        if t.isdigit():
            wmus.append(t)
    return wmus


def build_flat_rows(json_path):
    with open(json_path, "r") as f:
        regulation_data = json.load(f)

    rows = []
    last_species = None
    last_type = None

    for entry in regulation_data:
        table = entry["table"]

        for row in table:
            if row == ["Species", "Type", "SEASON", None, "WMUs"]:
                continue
            if row == [None, None, "Archery-only", "General", None]:
                continue
            if row and row[0] and "see page" in str(row[0]).lower():
                continue
            if len(row) < 5:
                continue

            species, type_, archery, general, wmus = row[:5]

            if species:
                last_species = species.replace("\n", " ").strip()
            if type_:
                last_type = type_.replace("\n", " ").strip()

            if not wmus:
                continue

            wmu_list = parse_wmu_list(wmus)
            if not wmu_list:
                continue

            archery_ranges = parse_season_ranges(archery)
            general_ranges = parse_season_ranges(general)

            for wmu in wmu_list:
                for start, end in archery_ranges:
                    rows.append({
                        "WMU": wmu,
                        "Animal": last_species,
                        "Tag Type": f"{last_type} (Archery)",
                        "Season Start": start,
                        "Season End": end
                    })
                for start, end in general_ranges:
                    rows.append({
                        "WMU": wmu,
                        "Animal": last_species,
                        "Tag Type": f"{last_type} (General)",
                        "Season Start": start,
                        "Season End": end
                    })

    return rows


if __name__ == "__main__":
    rows = build_flat_rows("data/regulations/regulation_tables.json")

    with open("data/regulations/regulation_flat.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["WMU", "Animal", "Tag Type", "Season Start", "Season End"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to data/regulations/regulation_flat.csv")