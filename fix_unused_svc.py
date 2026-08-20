import re

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("import { useAuth } from '../auth/useAuth';", "")
text = re.sub(r'const loadAllLookupPages = async.*?\};\n', '', text, flags=re.DOTALL)

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("done")
