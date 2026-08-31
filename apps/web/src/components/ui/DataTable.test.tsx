import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataTable, type DataTableColumn } from './DataTable';

type TestRow = {
  id: string;
  patient: string;
  status: string;
};

describe('DataTable responsive labels', () => {
  it('uses column headers as cell data labels without changing rendered values', () => {
    const columns: DataTableColumn<TestRow>[] = [
      { key: 'patient', header: 'Patient', render: (row) => row.patient },
      { key: 'status', header: 'Status', render: (row) => row.status },
    ];

    const markup = renderToStaticMarkup(
      <DataTable
        columns={columns}
        getRowKey={(row) => row.id}
        rows={[{ id: '1', patient: 'Asha Rao', status: 'Active' }]}
      />,
    );

    expect(markup).toContain('class="data-table responsive-table"');
    expect(markup).toContain('data-label="Patient">Asha Rao</td>');
    expect(markup).toContain('data-label="Status">Active</td>');
  });
});

