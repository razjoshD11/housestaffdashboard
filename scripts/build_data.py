#!/usr/bin/env python3
"""
ETL: pulls 2025 House SOD detail grids, filters to target Democratic members,
aggregates staff salaries (annualized), office, travel, top-5 other expenses.
Emits site/data.json consumed by the static dashboard.
"""
import csv, json, sys
from collections import defaultdict
from pathlib import Path

csv.field_size_limit(sys.maxsize)

DOWNLOADS = Path("/Users/joshraznick/Downloads")
QUARTERS = [
    ("Q1", "JANUARY-MARCH-2025-SOD-DETAIL-GRID-FINAL.csv"),
    ("Q2", "APRIL-JUNE 2025 SOD DETAIL GRID-FINAL.csv"),
    ("Q3", "JULY-SEPTEMBER 2025 SOD DETAIL GRID-FINAL.csv"),
    ("Q4", "OCT-DEC-2025-SOD-DETAIL-GRID-FINAL.csv"),
]

TARGETS = [
    {"city": "San Francisco", "state": "CA", "district": "CA-11", "match": "NANCY PELOSI",            "name": "Nancy Pelosi"},
    {"city": "San Francisco", "state": "CA", "district": "CA-15", "match": "KEVIN MULLIN",            "name": "Kevin Mullin"},
    {"city": "Los Angeles",   "state": "CA", "district": "CA-30", "match": "BRAD SHERMAN",            "name": "Brad Sherman"},
    {"city": "Los Angeles",   "state": "CA", "district": "CA-34", "match": "JIMMY GOMEZ",             "name": "Jimmy Gomez"},
    {"city": "Los Angeles",   "state": "CA", "district": "CA-37", "match": "SYDNEY KAMLAGER-DOVE",    "name": "Sydney Kamlager-Dove"},
    {"city": "Los Angeles",   "state": "CA", "district": "CA-43", "match": "MAXINE WATERS",           "name": "Maxine Waters"},
    {"city": "Los Angeles",   "state": "CA", "district": "CA-44", "match": "NANETTE DIAZ BARRAGAN",   "name": "Nanette Barragán"},
    {"city": "New York City", "state": "NY", "district": "NY-7",  "match": "JERROLD NADLER",          "name": "Jerrold Nadler"},
    {"city": "New York City", "state": "NY", "district": "NY-8",  "match": "HAKEEM S. JEFFRIES",      "name": "Hakeem Jeffries"},
    {"city": "New York City", "state": "NY", "district": "NY-9",  "match": "YVETTE D. CLARKE",        "name": "Yvette Clarke"},
    {"city": "New York City", "state": "NY", "district": "NY-10", "match": "DANIEL S. GOLDMAN",       "name": "Daniel Goldman"},
    {"city": "New York City", "state": "NY", "district": "NY-12", "match": "NYDIA M. VELAZQUEZ",      "name": "Nydia Velázquez"},
    {"city": "New York City", "state": "NY", "district": "NY-13", "match": "ADRIANO ESPAILLAT",       "name": "Adriano Espaillat"},
    {"city": "New York City", "state": "NY", "district": "NY-14", "match": "ALEXANDRIA OCASIO-CORTEZ","name": "Alexandria Ocasio-Cortez"},
    {"city": "New York City", "state": "NY", "district": "NY-15", "match": "RITCHIE TORRES",          "name": "Ritchie Torres"},
    {"city": "Miami",         "state": "FL", "district": "FL-24", "match": "FREDERICA S. WILSON",     "name": "Frederica Wilson"},
    {"city": "Chicago",       "state": "IL", "district": "IL-1",  "match": "JONATHAN L. JACKSON",     "name": "Jonathan Jackson"},
    {"city": "Chicago",       "state": "IL", "district": "IL-2",  "match": "ROBIN L. KELLY",          "name": "Robin Kelly"},
    {"city": "Chicago",       "state": "IL", "district": "IL-4",  "match": "CHUY",                    "name": "Jesús \"Chuy\" García"},
    {"city": "Chicago",       "state": "IL", "district": "IL-5",  "match": "MIKE QUIGLEY",            "name": "Mike Quigley"},
    {"city": "Chicago",       "state": "IL", "district": "IL-7",  "match": "DANNY K. DAVIS",          "name": "Danny Davis"},
    {"city": "Chicago",       "state": "IL", "district": "IL-9",  "match": "JANICE D. SCHAKOWSKY",    "name": "Jan Schakowsky"},
    {"city": "Boston",        "state": "MA", "district": "MA-7",  "match": "AYANNA PRESSLEY",         "name": "Ayanna Pressley"},
    {"city": "Boston",        "state": "MA", "district": "MA-8",  "match": "STEPHEN F. LYNCH",        "name": "Stephen Lynch"},
    {"city": "Seattle",       "state": "WA", "district": "WA-7",  "match": "PRAMILA JAYAPAL",         "name": "Pramila Jayapal"},
]


def org_to_target_idx(org):
    org_u = org.upper()
    if not org_u.startswith("2025 HON"):
        return None
    for i, t in enumerate(TARGETS):
        if t["match"] in org_u:
            return i
    return None


SUFFIXES = {"JR", "SR", "II", "III", "IV"}


def flip_name(s):
    """Convert SOD 'LAST FIRST M.' to 'First M. Last', preserving suffixes (Jr., II)."""
    s = (s or "").strip()
    if not s:
        return s
    tokens = s.split()
    suffix = None
    if tokens and tokens[-1].rstrip(".").upper() in SUFFIXES:
        suffix = tokens.pop()
    if not tokens:
        return s.title()
    last = tokens[0]
    rest = tokens[1:]
    parts = rest + [last]
    if suffix:
        parts.append(suffix)
    return " ".join(parts).title()


def parse_amount(s):
    if s is None:
        return 0.0
    s = s.strip().replace(",", "")
    if not s:
        return 0.0
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return 0.0


def main():
    records = defaultdict(list)
    quarters_seen = defaultdict(set)

    for qkey, fname in QUARTERS:
        path = DOWNLOADS / fname
        if not path.exists():
            print(f"MISSING: {path}", file=sys.stderr)
            continue
        with open(path, newline="", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            reader.fieldnames = [h.strip() for h in reader.fieldnames]
            n_rows = 0
            n_kept = 0
            for row in reader:
                n_rows += 1
                org = (row.get("ORGANIZATION") or "").strip()
                idx = org_to_target_idx(org)
                if idx is None:
                    continue
                # Only DETAIL rows; skip SUBTOTAL and GRAND TOTAL FOR ORGANIZATION
                if (row.get("SORT SEQUENCE") or "").strip().upper() != "DETAIL":
                    continue
                amount = parse_amount(row.get("AMOUNT", ""))
                rec = {
                    "quarter": qkey,
                    "category": (row.get("SORT SUBTOTAL DESCRIPTION") or "").strip(),
                    "boc": (row.get("BUDGET OBJECT CLASS") or "").strip(),
                    "boc_code": (row.get("BUDGET OBJECT CODE") or "").strip(),
                    "vendor": (row.get("VENDOR NAME") or "").strip(),
                    "description": (row.get("DESCRIPTION") or "").strip(),
                    "perform_start": (row.get("PERFORM START DT") or "").strip(),
                    "perform_end": (row.get("PERFORM END DT") or "").strip(),
                    "amount": amount,
                }
                records[idx].append(rec)
                quarters_seen[idx].add(qkey)
                n_kept += 1
        print(f"{qkey}: {n_rows:,} rows scanned, {n_kept:,} kept", file=sys.stderr)

    out_members = []
    for i, t in enumerate(TARGETS):
        rows = records.get(i, [])
        member_quarters = sorted(quarters_seen.get(i, set()))
        n_quarters = len(member_quarters)

        by_cat = defaultdict(float)
        for r in rows:
            by_cat[r["category"] or "(uncategorized)"] += r["amount"]
        total_spent = sum(by_cat.values())

        staff_payments = defaultdict(lambda: {
            "title": "",
            "by_q": defaultdict(float),
            "quarters": set(),
            "total_paid": 0.0,
        })
        for r in rows:
            if r["category"].upper() != "PERSONNEL COMPENSATION":
                continue
            vendor = r["vendor"]
            if not vendor:
                continue
            staff_payments[vendor]["by_q"][r["quarter"]] += r["amount"]
            staff_payments[vendor]["quarters"].add(r["quarter"])
            staff_payments[vendor]["total_paid"] += r["amount"]
            if r["description"]:
                staff_payments[vendor]["title"] = r["description"]

        staff_list = []
        total_staff_spend = 0.0
        for emp_name, data in staff_payments.items():
            qs = sorted(data["quarters"])
            n_qs = len(qs)
            paid = data["total_paid"]
            total_staff_spend += paid
            months_worked = n_qs * 3
            if n_qs >= 4:
                annualized = paid
                note = ""
            elif months_worked > 0:
                annualized = paid / months_worked * 12
                note = f"Estimated from {n_qs} quarter(s) of pay; not full year on payroll"
            else:
                annualized = 0.0
                note = "No quarters of pay"
            staff_list.append({
                "name": flip_name(emp_name),
                "title": data["title"].title() if data["title"] else "",
                "annualized_salary": round(annualized, 2),
                "total_paid_2025": round(paid, 2),
                "quarters_paid": qs,
                "n_quarters_paid": n_qs,
                "note": note,
            })
        staff_list.sort(key=lambda x: x["annualized_salary"], reverse=True)

        office_cats = {
            "RENT  COMMUNICATION  UTILITIES",
            "SUPPLIES AND MATERIALS",
            "PRINTING AND REPRODUCTION",
        }
        travel_cats = {"TRAVEL"}

        office_total = sum(amt for cat, amt in by_cat.items() if cat.upper() in office_cats)
        travel_total = sum(amt for cat, amt in by_cat.items() if cat.upper() in travel_cats)

        excluded = {"PERSONNEL COMPENSATION"} | office_cats | travel_cats
        other_lines = defaultdict(lambda: {"amount": 0.0, "category": "", "examples": set()})
        for r in rows:
            cat_u = r["category"].upper()
            if cat_u in excluded:
                continue
            key = (r["category"], r["vendor"] or "(no vendor)")
            other_lines[key]["amount"] += r["amount"]
            other_lines[key]["category"] = r["category"]
            if r["description"]:
                other_lines[key]["examples"].add(r["description"][:80])

        other_sorted = sorted(other_lines.items(), key=lambda kv: kv[1]["amount"], reverse=True)
        top5_other = []
        for (cat, vendor), v in other_sorted[:5]:
            top5_other.append({
                "category": cat,
                "vendor": vendor.title() if vendor else "",
                "amount": round(v["amount"], 2),
                "examples": sorted(list(v["examples"]))[:3],
            })

        q_trend = defaultdict(float)
        for r in rows:
            q_trend[r["quarter"]] += r["amount"]
        quarterly = [{"quarter": q, "amount": round(q_trend.get(q, 0.0), 2)} for q in ["Q1", "Q2", "Q3", "Q4"]]

        cat_breakdown = sorted(
            [{"category": k, "amount": round(v, 2)} for k, v in by_cat.items() if v != 0],
            key=lambda x: x["amount"], reverse=True
        )

        out_members.append({
            "name": t["name"],
            "city": t["city"],
            "state": t["state"],
            "district": t["district"],
            "totals": {
                "total_spend": round(total_spent, 2),
                "staff_total": round(total_staff_spend, 2),
                "office_total": round(office_total, 2),
                "travel_total": round(travel_total, 2),
                "other_total": round(total_spent - total_staff_spend - office_total - travel_total, 2),
            },
            "staff": staff_list,
            "top_other": top5_other,
            "quarterly": quarterly,
            "category_breakdown": cat_breakdown,
            "n_quarters_active": n_quarters,
            "quarters_active": member_quarters,
        })

    cities = defaultdict(lambda: {"members": 0, "total_spend": 0.0, "staff_total": 0.0})
    for m in out_members:
        cities[m["city"]]["members"] += 1
        cities[m["city"]]["total_spend"] += m["totals"]["total_spend"]
        cities[m["city"]]["staff_total"] += m["totals"]["staff_total"]
    city_summary = [{"city": c, **vals} for c, vals in cities.items()]

    out = {
        "generated_at": "2025 fiscal year (Jan-Dec)",
        "members": out_members,
        "city_summary": city_summary,
    }

    out_path = Path(__file__).resolve().parents[1] / "data.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote {out_path} - {len(out_members)} members", file=sys.stderr)


if __name__ == "__main__":
    main()
