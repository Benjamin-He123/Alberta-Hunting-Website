import csv

def sort_into_wmu(file):
    regulation = {}

    with open(file, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)

        for row in reader:
            wmu = row[0]
            if wmu not in regulation:
                regulation[wmu] = []
            regulation[wmu].append(row[1:])

    return regulation

def write_csv(regulation, out_file):
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for (wmu, row) in enumerate(regulation.items()):
            writer.writerow([row])

if __name__ == "__main__":
    csv_path_1 = "data/regulations/regulation_flat.csv"
    csv_path_2 = "data/regulations/sorted_wmus.csv"
    regulation = sort_into_wmu(csv_path_1)
    write_csv(regulation, csv_path_2)



    
