import re

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = "import { type BranchResponse } from '../api/branches';\nimport { type DepartmentResponse } from '../api/departments';\n" + text
text = re.sub(r'type LookupPage<T> = \{.*?\};\n', '', text, flags=re.DOTALL)

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("done")
