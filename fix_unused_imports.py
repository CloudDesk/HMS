import re

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("import { type BranchResponse } from '../api/branches';\n", "")
text = text.replace("  servicesApi,\n", "")
text = text.replace("  type ServiceListResponse,\n", "")
text = text.replace("  type ServiceSummary,\n", "")

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("done")
