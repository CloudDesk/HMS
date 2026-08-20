import re
import subprocess

subprocess.run(["git", "checkout", "apps/web/src/pages/SystemSettingsPage.tsx"], check=True)

with open('apps/web/src/pages/SystemSettingsPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import_feature = "import { useSystemSettingsFeature } from '../hooks/settings/useSystemSettingsFeature';\n"
text = text.replace("import { useCallback, useEffect, useMemo, useRef, useState } from 'react';", "import { useMemo } from 'react';\n" + import_feature)
text = re.sub(r"import \{\n  useUpdateGeneralSettings,\n  useUpdateHospitalSettings,\n  useUpdateLocalizationSettings,\n  useUpdateUserPreferences,\n  useResetSettings,\n\} from '\.\./hooks/settings/useSettings';\n", "", text)
text = text.replace("import { hasPermission } from '../auth/access-control';\n", "")
text = text.replace("import { useAuth } from '../auth/useAuth';\n", "")
text = text.replace("  settingsApi,\n", "")

text = re.sub(r'const detailsToErrors = \(error: ApiError\): FieldErrors => \{[\s\S]*?return errors;\n\};\n\n', '', text)

start_str = "export function SystemSettingsPage() {"
end_str = "  const visibleTabs = useMemo("
start_idx = text.find(start_str)
end_idx = text.find(end_str)

new_body = """export function SystemSettingsPage() {
  const feature = useSystemSettingsFeature();
  const { state, data, status, rbac, actions } = feature;
  
  const { activeTab, navSearch, auditTotal, serverErrors: errors, logoUrl, toast, toastTone, setActiveTab, setNavSearch, setAuditTotal } = state;
  const { settings } = data;
  const { isFetching: loading, isMutating: busy, loadError } = status;
  const { canEdit } = rbac;
  const { updateGeneral, updateHospital, updateLocalization, updatePreferences, reset, uploadLogo, showMessage, refetch: load } = actions;

"""

text = text[:start_idx] + new_body + text[end_idx:]

text = text.replace("renderPanel()", "renderPanel(activeTab)")
text = text.replace("const renderPanel = () => {", "const renderPanel = (activeTab: TabId) => {")
text = text.replace("onClick={() => void load()}", "onClick={() => void load()}")
text = text.replace("setErrors({});", "")

# Remove extra occurrences of setErrors({})
text = text.replace(" onClick={() => { setActiveTab(tab as TabId);  }}", " onClick={() => { setActiveTab(tab as TabId); }}")
text = text.replace(" onClick={() => { setActiveTab(tab.id);  }}", " onClick={() => { setActiveTab(tab.id); }}")

with open('apps/web/src/pages/SystemSettingsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("done")
