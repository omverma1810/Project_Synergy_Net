from celery import shared_task
from django.utils import timezone


@shared_task
def extract_budget_data(budget_id):
    # Import inside task to avoid app-loading issues at module import time
    from .models import Budget, BudgetLineItem
    import pdfplumber
    import pandas as pd

    try:
        budget = Budget.objects.get(id=budget_id)
        budget.extraction_status = 'PROCESSING'
        budget.save(update_fields=['extraction_status'])

        file_path = budget.file.path
        line_items = []

        if budget.file_type == 'PDF':
            line_items = _extract_pdf(file_path)
        elif budget.file_type in ['CSV', 'XLSX']:
            line_items = _extract_spreadsheet(file_path)

        BudgetLineItem.objects.bulk_create([
            BudgetLineItem(
                budget=budget,
                account_code=item.get('account_code', ''),
                description=item.get('description', ''),
                category=item.get('category', ''),
                amount=item.get('amount', 0),
                currency=item.get('currency', 'USD'),
                sort_order=idx,
            )
            for idx, item in enumerate(line_items)
        ])

        budget.extraction_status = 'EXTRACTED'
        budget.confidence_score = 0.85
        budget.extracted_at = timezone.now()
        budget.save(update_fields=['extraction_status', 'confidence_score', 'extracted_at'])

    except Budget.DoesNotExist:
        raise
    except Exception as e:
        Budget.objects.filter(id=budget_id).update(extraction_status='FAILED')
        raise e


def _extract_pdf(file_path):
    import pdfplumber
    items = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                for table in (page.extract_tables() or []):
                    for row in table:
                        if len(row) >= 3 and any(row):
                            items.append({
                                'account_code': str(row[0]) if row[0] else '',
                                'description': str(row[1]) if row[1] else '',
                                'amount': _parse_amount(row[2]) if row[2] else 0,
                                'category': 'Uncategorized',
                            })
    except Exception:
        pass
    return items


def _extract_spreadsheet(file_path):
    import pandas as pd
    items = []
    try:
        df = pd.read_csv(file_path) if file_path.endswith('.csv') else pd.read_excel(file_path)
        for _, row in df.iterrows():
            items.append({
                'account_code': str(row.get('Account Code', row.iloc[0] if len(row) > 0 else '')),
                'description': str(row.get('Description', row.iloc[1] if len(row) > 1 else '')),
                'amount': _parse_amount(row.get('Amount', row.iloc[2] if len(row) > 2 else 0)),
                'category': str(row.get('Category', 'Uncategorized')),
            })
    except Exception:
        pass
    return items


def _parse_amount(value):
    import pandas as pd
    if value is None:
        return 0
    try:
        if pd.isna(value):
            return 0
    except (TypeError, ValueError):
        pass
    try:
        return float(str(value).replace(',', '').replace('$', '').replace('€', '').replace('£', ''))
    except (ValueError, TypeError):
        return 0
