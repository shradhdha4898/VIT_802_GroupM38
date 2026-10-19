import csv
import io
from datetime import date, time, datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models import Attendance_History, Import_Log


REQUIRED_COLUMNS = ["Employee_ID", "Punch_Date", "Punch_In", "Punch_Out", "Department", "Cost_Centre"]


def _parse_time(value: str) -> time | None:
    """Parse HH:MM or HH:MM:SS string into a time object. Returns None if empty."""
    if not value or value.strip() == "":
        return None
    parts = value.strip().split(":")
    if len(parts) < 2:
        return None
    try:
        h, m = int(parts[0]), int(parts[1])
        s = int(parts[2]) if len(parts) > 2 else 0
        return time(h, m, s)
    except (ValueError, TypeError):
        return None


def upload_attendance(db: Session, file_bytes: bytes, filename: str, import_month: str):
    # D2: reject anything that is not a .csv before reading or deleting
    name = (filename or "").strip().lower()
    if not name.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv files are accepted",
        )

    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not valid CSV text",
        )

    reader = csv.DictReader(io.StringIO(text))
    records = list(reader)

    if not records:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty")

    headers = list(records[0].keys())
    for col in REQUIRED_COLUMNS:
        if col not in headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CSV missing required column: {col}",
            )

    # D5: validate every row before touching the stored month
    prepared = []
    for index, r in enumerate(records, start=2):
        punch_in = _parse_time(r.get("Punch_In", ""))
        if punch_in is None:
            punch_in = time(0, 0, 0)

        punch_out = _parse_time(r.get("Punch_Out", ""))

        raw_date = (r.get("Punch_Date") or "").strip()
        try:
            punch_date = date.fromisoformat(raw_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Punch_Date format on row {index}: {r.get('Punch_Date')}",
            )

        prepared.append({
            "Employee_ID": (r.get("Employee_ID") or "").strip(),
            "Punch_Date": punch_date,
            "Punch_In": punch_in,
            "Punch_Out": punch_out,
            "Department": (r.get("Department") or "").strip(),
            "Cost_Centre": (r.get("Cost_Centre") or "").strip(),
        })

    # File is valid. Replace the month in one transaction.
    try:
        db.query(Attendance_History).filter(Attendance_History.Import_Month == import_month).delete()

        rows = [
            Attendance_History(
                Employee_ID=item["Employee_ID"],
                Punch_Date=item["Punch_Date"],
                Punch_In=item["Punch_In"],
                Punch_Out=item["Punch_Out"],
                Department=item["Department"],
                Cost_Centre=item["Cost_Centre"],
                Source_File=filename,
                Import_Month=import_month,
            )
            for item in prepared
        ]
        db.bulk_save_objects(rows)

        log = Import_Log(
            Import_Month=import_month,
            Source_File=filename,
            Row_Count=len(prepared),
            Imported_At=datetime.utcnow(),
        )
        db.add(log)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upload failed and the existing month was left unchanged",
        )

    return {"inserted": len(prepared), "importMonth": import_month}


def get_history(db: Session, import_month: str):
    return (
        db.query(Attendance_History)
        .filter(Attendance_History.Import_Month == import_month)
        .order_by(Attendance_History.Employee_ID, Attendance_History.Punch_Date)
        .all()
    )
