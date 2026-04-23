import { NextRequest, NextResponse } from 'next/server';
import { Workbook } from 'exceljs';

type ExportRequest = {
  filename: string;
  sheetName: string;
  data: Record<string, string | number>[];
};

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();

    if (!body.data || !Array.isArray(body.data)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }

    if (!body.filename || !body.sheetName) {
      return NextResponse.json(
        { error: 'Filename and sheet name are required' },
        { status: 400 }
      );
    }

    // Create workbook and worksheet
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet(body.sheetName);

    if (body.data.length > 0) {
      // Add headers
      const headers = Object.keys(body.data[0]);
      worksheet.columns = headers.map((header) => ({
        header,
        key: header
      }));

      // Add rows
      body.data.forEach((row) => {
        worksheet.addRow(row);
      });

      // Auto-fit columns
      worksheet.columns?.forEach((column) => {
        let maxLength = (column.header as string)?.length ?? 0;
        if (column.key) {
          body.data.forEach((row) => {
            const cellValue = row[column.key as string];
            if (cellValue) {
              const length = String(cellValue).length;
              if (length > maxLength) {
                maxLength = length;
              }
            }
          });
        }
        column.width = Math.min(maxLength + 2, 50);
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return file as response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${body.filename}"`
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        error: 'Export failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
