import re
with open('apps/web/src/pages/BranchManagementPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace handleSave
old_handle = r'  const handleSave = async \(event: FormEvent\) => \{.*?\n      \}\n\n      closeModal\(\);\n    \} catch \(error\) \{\n      setFormError\(error instanceof ApiError \? error\.message \: \'An error occurred\'\);\n    \}\n  \};\n'
code = re.sub(old_handle, '', code, flags=re.DOTALL)

# Fix remaining `form.` refs in JSX
code = re.sub(r'\s*onChange=\{\(e\) => setForm\(\{ \.\.\.form, ([a-zA-Z]+): e\.target\.value \}\)\}\s*(required)?\s*type="tel"\s*value=\{form\.[a-zA-Z]+\}', lambda m: f"\n                    type=\"tel\"\n                    {{...branchForm.register('{m.group(1)}')}}", code)
code = re.sub(r'onChange=\{\(e\) => setForm\(\{ \.\.\.form, ([a-zA-Z]+): e\.target\.value \}\)\}\s*value=\{form\.[a-zA-Z]+\}', lambda m: f"{{...branchForm.register('{m.group(1)}')}}", code)
code = re.sub(r'value=\{form\.[a-zA-Z]+\}', '', code)

with open('apps/web/src/pages/BranchManagementPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
