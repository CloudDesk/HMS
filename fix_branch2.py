import re

def fix():
    with open('apps/web/src/pages/BranchManagementPage.tsx', 'r', encoding='utf-8') as f:
        code = f.read()

    # Imports
    code = code.replace(
        "import { useEffect, useState, type FormEvent } from 'react';",
        "import { useEffect, useState } from 'react';\nimport { useForm } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';\nimport { z } from 'zod';"
    )

    # Schema
    schema = """
const branchSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  shortName: z.string().optional(),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived'])
});
type BranchFormData = z.infer<typeof branchSchema>;
"""
    code = re.sub(r'type BranchFormState = \{.*?status: ApiBranchStatus;\n};\n', schema, code, flags=re.DOTALL)
    code = re.sub(r'const emptyForm: BranchFormState = \{.*?status: \'active\',\n};\n', '', code, flags=re.DOTALL)

    # State init
    state_replace = """  const branchForm = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      code: '', name: '', shortName: '', email: '', phone: '', address: '',
      city: '', state: '', country: '', postalCode: '', status: 'active'
    }
  });"""
    code = re.sub(r'  const \[form, setForm\] = useState<BranchFormState>\(emptyForm\);\n', state_replace + '\n', code)

    # Handlers
    handle_save = """  const handleSave = async (data: BranchFormData) => {
    setFormError('');

    try {
      const payload: UpdateBranchPayload = {
        code: data.code,
        name: data.name,
        short_name: data.shortName || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        country: data.country || undefined,
        postal_code: data.postalCode || undefined,
        status: data.status as ApiBranchStatus,
      };

      if (modalMode === 'create') {
        await createBranch(payload as any);
        showToast('Branch created successfully');
      } else if (modalMode === 'edit' && activeBranch) {
        await updateBranch({ id: activeBranch.id, payload });
        showToast('Branch updated successfully');
      }

      closeModal();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'An error occurred');
    }
  };"""
    code = re.sub(r'  const handleSave = async \(event: FormEvent\) => \{.*?\n      \}\n\n      closeModal\(\);\n    \} catch \(error\) \{\n      setFormError\(error instanceof ApiError \? error\.message : \'An error occurred\'\);\n    \}\n  };\n', handle_save + '\n', code, flags=re.DOTALL)

    # Open Modal
    open_modal = """  const openModal = (mode: ModalMode, branch?: BranchResponse) => {
    setModalMode(mode);
    setActiveBranch(branch ?? null);
    setFormError('');
    branchForm.reset({
      code: branch?.code ?? '',
      name: branch?.name ?? '',
      shortName: branch?.short_name ?? '',
      email: branch?.email ?? '',
      phone: branch?.phone ?? '',
      address: branch?.address ?? '',
      city: branch?.city ?? '',
      state: branch?.state ?? '',
      country: branch?.country ?? '',
      postalCode: branch?.postal_code ?? '',
      status: branch?.status ?? 'active',
    });
  };"""
    code = re.sub(r'  const openModal = \(mode: ModalMode, branch\?: BranchResponse\) => \{.*?\n  };\n', open_modal + '\n', code, flags=re.DOTALL)

    # JSX Bindings
    code = code.replace('<form className="modal-form" id="branch-management-form" onSubmit={handleSave}>', '<form className="modal-form" id="branch-management-form" onSubmit={(e) => { e.stopPropagation(); void branchForm.handleSubmit(handleSave)(e); }}>')
    
    def r(m):
        f = m.group(1)
        req = m.group(2) or ''
        typ = m.group(3) or ''
        return f'{req}\n                    {typ}\n                    {{...branchForm.register("{f}")}}'

    code = re.sub(r'onChange=\{\(e\) => setForm\(\{ \.\.\.form, ([a-zA-Z]+): e\.target\.value \}\)\}\s*(required)?\s*(type="text"|type="email")?\s*value=\{form\.[a-zA-Z]+\}', r, code)
    code = re.sub(r'onChange=\{\(e\) => setForm\(\{ \.\.\.form, ([a-zA-Z]+): e\.target\.value as ApiBranchStatus \}\)\}\s*(required)?\s*value=\{form\.[a-zA-Z]+\}', r, code)

    # Remove errors rendering from formError if we didn't add form errors in UI.
    # original had global formError banner, let's keep it.

    with open('apps/web/src/pages/BranchManagementPage.tsx', 'w', encoding='utf-8') as f:
        f.write(code)

if __name__ == '__main__':
    fix()
