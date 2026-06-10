import io
from django.template.loader import render_to_string
from django.conf import settings
from weasyprint import HTML
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment


class PDFReportGenerator:
    def __init__(self, analysis):
        self.analysis = analysis
        self.results = analysis.results.all().select_related('territory')
        self.project = analysis.project

    def generate(self):
        html_string = render_to_string('reports/analysis_report.html', {
            'project': self.project,
            'analysis': self.analysis,
            'results': self.results,
        })
        pdf = HTML(string=html_string, base_url=str(settings.BASE_DIR)).write_pdf()
        return pdf


class ExcelReportGenerator:
    def __init__(self, analysis):
        self.analysis = analysis
        self.results = analysis.results.all().select_related('territory')
        self.project = analysis.project

    def generate(self):
        wb = openpyxl.Workbook()

        ws = wb.active
        ws.title = "Summary"
        ws.append(["Project", self.project.title])
        ws.append(["Analysis Date", self.analysis.created_at.strftime("%Y-%m-%d %H:%M")])
        ws.append(["Total Budget", f"{self.project.total_budget} {self.project.currency}"])
        ws.append([])
        ws.append([
            "Rank", "Territory", "Rebate %", "Qualified Spend",
            "Estimated Rebate", "Logistics Premium", "Net Benefit", "Confidence",
        ])

        for result in self.results:
            ws.append([
                result.rank,
                result.territory.name,
                f"{result.territory.base_percentage}%",
                float(result.qualified_spend_total),
                float(result.estimated_rebate),
                float(result.logistics_premium),
                float(result.net_benefit),
                f"{result.confidence_score * 100}%",
            ])

        header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        for cell in ws[5]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center')

        ws2 = wb.create_sheet("Details")
        ws2.append(["Territory", "Category", "Total Amount", "Qualified Amount"])
        for result in self.results:
            for cat, vals in result.details.get('category_breakdown', {}).items():
                ws2.append([
                    result.territory.name,
                    cat,
                    vals['total'],
                    vals['qualified'],
                ])

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()
