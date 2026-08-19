import re
import os

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import_dept = "import { type DepartmentResponse } from '../api/departments';\n"
if 'DepartmentResponse' not in text.split('export function')[0]:
    text = text.replace("import { type BranchResponse } from '../api/branches';", "import { type BranchResponse } from '../api/branches';\n" + import_dept)

text = text.replace('if (lookupsLoading) return', 'if (loading) return')
text = text.replace('{lookupError &&', '{loadError &&')
text = text.replace('lookupError ?', 'loadError ?')
text = text.replace('lookupError', 'loadError')
text = text.replace('lookupsLoading', 'loading')

text = text.replace("import { useAuth } from '../auth/useAuth';", "")
text = re.sub(r'const loadAllLookupPages = async.*?\};\n', '', text, flags=re.DOTALL)

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("done")
