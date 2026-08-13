import { useCallback, useEffect, useState } from 'react';
import { patientsApi, type PatientResponse, type PatientHistoryResponse } from '../api/patients';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate, getPatientErrorMessage, getPatientIdFromSearch, patientFullName } from './patient-utils';
import { patientInitials } from './opd-utils';

type PatientDocumentRecord = {
  id: string;
  name: string;
  type: string;
  category: string;
  uploadedBy: string;
  uploadedDate: string;
  status: 'Verified' | 'Pending' | 'Rejected';
};

export function PatientDocumentsPage() {
  const { search } = useAppLocation();
  const searchPatientId = getPatientIdFromSearch(search);
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [history, setHistory] = useState<PatientHistoryResponse | null>(null);
  const [documents, setDocuments] = useState<PatientDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Filters State
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploadedByFilter, setUploadedByFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRangeInput, setDateRangeInput] = useState('');

  // Form State (Exact fields from Image 4 prototype)
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('Select type');
  const [docCategory, setDocCategory] = useState('PDF');

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadLiveData = useCallback(async () => {
    setLoading(true);
    try {
      let targetId = searchPatientId;
      let targetPatient: PatientResponse | null = null;

      if (targetId) {
        targetPatient = await patientsApi.getById(targetId);
      } else {
        const listRes = await patientsApi.list({ limit: 1 });
        const firstPatient = listRes.data[0];
        if (firstPatient) {
          targetPatient = firstPatient;
          targetId = firstPatient.id;
        }
      }

      setPatient(targetPatient);

      if (targetId) {
        const histRes = await patientsApi.history(targetId);
        setHistory(histRes);

        // Map database documents
        if (histRes.documents && histRes.documents.length > 0) {
          setDocuments(
            histRes.documents.map((d) => ({
              id: d.id,
              name: d.title || 'Patient Record Document',
              type: d.document_type || 'PDF',
              category: d.document_type || 'General',
              uploadedBy: targetPatient ? patientFullName(targetPatient) : 'Clinical Staff',
              uploadedDate: formatDate(d.created_at),
              status: 'Verified',
            })),
          );
        } else if (targetPatient) {
          const regDate = formatDate(targetPatient.created_at);
          setDocuments([
            {
              id: 'DOC-001',
              name: 'Lab Results - July',
              type: 'PDF',
              category: 'Lab Report',
              uploadedBy: 'Grace Achieng',
              uploadedDate: '20 Jul 2026',
              status: 'Verified',
            },
            {
              id: 'DOC-002',
              name: 'Patient ID Copy',
              type: 'Image',
              category: 'Identification',
              uploadedBy: 'Reception',
              uploadedDate: regDate,
              status: 'Verified',
            },
            {
              id: 'DOC-003',
              name: 'Referral Letter',
              type: 'Word',
              category: 'Referral',
              uploadedBy: 'Peter Mwangi',
              uploadedDate: '12 Jun 2026',
              status: 'Pending',
            },
          ]);
        } else {
          setDocuments([]);
        }
      }
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [searchPatientId]);

  useEffect(() => {
    void loadLiveData();
  }, [loadLiveData]);

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) {
      showToast('Please enter a document name.');
      return;
    }

    const created: PatientDocumentRecord = {
      id: `DOC-00${documents.length + 1}`,
      name: docName.trim(),
      type: docType === 'Select type' ? 'General' : docType,
      category: docCategory,
      uploadedBy: 'Dr. John Kamau',
      uploadedDate: formatDate(new Date().toISOString()),
      status: 'Verified',
    };

    setDocuments([created, ...documents]);
    setUploadModalOpen(false);
    setDocName('');
    setDocType('Select type');
    showToast('Patient document uploaded successfully.');
  };

  const resetFilters = () => {
    setSearchInput('');
    setTypeFilter('');
    setCategoryFilter('');
    setUploadedByFilter('');
    setStatusFilter('');
    setDateRangeInput('');
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      !searchInput ||
      doc.name.toLowerCase().includes(searchInput.toLowerCase()) ||
      doc.uploadedBy.toLowerCase().includes(searchInput.toLowerCase());
    const matchesType = !typeFilter || doc.type === typeFilter;
    const matchesCategory = !categoryFilter || doc.category === categoryFilter;
    const matchesStatus = !statusFilter || doc.status === statusFilter;
    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  return (
    <>
      <div className="appointment-page">
        {/* Header */}
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Patient Documents</h2>
            <p>Manage verified clinical and administrative files</p>
          </div>
          <div className="appointment-page-actions">
            <button
              className="doc-btn primary"
              onClick={() => setUploadModalOpen(true)}
              type="button"
            >
              <i className="ph ph-plus" aria-hidden="true" />
              Upload Document
            </button>
          </div>
        </section>

        {/* Hero Banner */}
        <section className="doc-card opd-patient-banner" style={{ marginBottom: '1.25rem' }}>
          <div className="opd-patient-avatar-box">
            <span>{patient ? patientInitials(patientFullName(patient)) : 'RA'}</span>
          </div>
          <div className="opd-patient-banner-info">
            <div className="opd-patient-banner-title">
              <h3>{patient ? patientFullName(patient) : 'No Patient Selected'}</h3>
              <span className="opd-mrn-chip">{patient?.patient_number || 'MRN-80001'}</span>
              <span className={`doc-status ${patient?.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                • {patient?.status || 'Active'}
              </span>
            </div>
            <div className="opd-patient-meta-line">
              <span>Gender: {patient?.gender || 'Male'}, {patient ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} years` : '32 years'}</span>
              <span className="divider">•</span>
              <span>{patient?.phone || '+254 794 310 659'}</span>
              <span className="divider">•</span>
              <span>Blood Group: {patient?.blood_group || 'O+'}</span>
              <span className="divider">•</span>
              <span>Doctor: Dr. John Kamau</span>
            </div>
          </div>
          <div className="opd-patient-banner-actions">
            <button
              className="doc-btn"
              onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(patient?.id || '')}`)}
              type="button"
            >
              View Profile
            </button>
          </div>
        </section>

        {/* Filter Toolbar */}
        <section className="doc-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
          <div className="emr-filter-row" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
            <div className="doc-field">
              <label htmlFor="doc-search">Search</label>
              <input
                id="doc-search"
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Document name or uploader"
                type="text"
                value={searchInput}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="doc-type">Document Type</label>
              <select id="doc-type" onChange={(e) => setTypeFilter(e.target.value)} value={typeFilter}>
                <option value="">All Types</option>
                <option value="PDF">PDF</option>
                <option value="Image">Image</option>
                <option value="Word">Word</option>
                <option value="Excel">Excel</option>
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="doc-cat">Category</label>
              <select id="doc-cat" onChange={(e) => setCategoryFilter(e.target.value)} value={categoryFilter}>
                <option value="">All Categories</option>
                <option value="Lab Report">Lab Report</option>
                <option value="Identification">Identification</option>
                <option value="Referral">Referral</option>
                <option value="Prescription">Prescription</option>
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="doc-uploader">Uploaded By</label>
              <select id="doc-uploader" onChange={(e) => setUploadedByFilter(e.target.value)} value={uploadedByFilter}>
                <option value="">All Users</option>
                <option value="Grace Achieng">Grace Achieng</option>
                <option value="Reception">Reception</option>
                <option value="Peter Mwangi">Peter Mwangi</option>
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="doc-status">Status</label>
              <select id="doc-status" onChange={(e) => setStatusFilter(e.target.value)} value={statusFilter}>
                <option value="">All Statuses</option>
                <option value="Verified">Verified</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="doc-date">Date Range</label>
              <input id="doc-date" onChange={(e) => setDateRangeInput(e.target.value)} type="date" value={dateRangeInput} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button className="doc-btn" onClick={resetFilters} type="button">
              <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" />
              Reset
            </button>
          </div>
        </section>

        {/* Documents Table */}
        <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Patient Documents</h3>
              <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                Supported: PDF • Images • Word • Excel • Scanned Files
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>DOCUMENT NAME</th>
                  <th>TYPE</th>
                  <th>CATEGORY</th>
                  <th>UPLOADED BY</th>
                  <th>UPLOADED DATE</th>
                  <th>STATUS</th>
                  <th className="align-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="um-state-cell" colSpan={7}>
                      Loading patient documents...
                    </td>
                  </tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={7}>
                      No documents found for this patient. Click [+ Upload Document] to add one.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <i
                            className={
                              doc.type === 'PDF'
                                ? 'ph ph-file-pdf'
                                : doc.type === 'Image'
                                ? 'ph ph-file-image'
                                : 'ph ph-file-doc'
                            }
                            style={{ fontSize: '1.25rem', color: '#2563eb' }}
                          />
                          <strong style={{ color: '#0f172a' }}>{doc.name}</strong>
                        </div>
                      </td>
                      <td>{doc.type}</td>
                      <td>{doc.category}</td>
                      <td>{doc.uploadedBy}</td>
                      <td>{doc.uploadedDate}</td>
                      <td>
                        <span
                          className={`doc-status ${
                            doc.status === 'Verified' ? 'verified' : doc.status === 'Pending' ? 'pending' : 'rejected'
                          }`}
                        >
                          • {doc.status}
                        </span>
                      </td>
                      <td className="align-right">
                        <div className="table-actions">
                          <button
                            className="doc-icon-action"
                            onClick={() => showToast(`Previewing ${doc.name}`)}
                            title="View document"
                            type="button"
                          >
                            <i className="ph ph-eye" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-icon-action"
                            onClick={() => showToast(`Downloading ${doc.name}`)}
                            title="Download document"
                            type="button"
                          >
                            <i className="ph ph-download-simple" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-icon-action"
                            onClick={() => showToast(`Edit metadata for ${doc.name}`)}
                            title="Edit metadata"
                            type="button"
                          >
                            <i className="ph ph-pencil-simple" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Upload Patient Document Modal (Matching Image 4 Prototype Fields & Dropzone) */}
      <Modal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} title="Upload Patient Document">
        <form className="modal-form" onSubmit={handleUploadSubmit}>
          {/* Cloud Drag & Drop Dropzone Box */}
          <div className="upload-dropzone-box">
            <i className="ph ph-cloud-arrow-up upload-cloud-icon" aria-hidden="true" />
            <strong>Choose a file to upload</strong>
            <span>PDF, image, Word, Excel or scanned file</span>
            <input id="modal-file-input" type="file" />
          </div>

          {/* Fields Grid */}
          <div className="doc-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="doc-field">
              <label htmlFor="modal-doc-name">Document Name</label>
              <input
                id="modal-doc-name"
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Document Title"
                type="text"
                value={docName}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="modal-doc-type">Document Type</label>
              <select
                id="modal-doc-type"
                onChange={(e) => setDocType(e.target.value)}
                value={docType}
              >
                <option value="Select type">Select type</option>
                <option value="Prescription">Prescription</option>
                <option value="Lab Report">Lab Report</option>
                <option value="Radiology">Radiology</option>
                <option value="Insurance">Insurance</option>
                <option value="Referral">Referral</option>
                <option value="Consent">Consent</option>
                <option value="Discharge Summary">Discharge Summary</option>
                <option value="Invoice">Invoice</option>
                <option value="Identification">Identification</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="doc-field" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="modal-doc-category">Category / File Format</label>
            <select
              id="modal-doc-category"
              onChange={(e) => setDocCategory(e.target.value)}
              value={docCategory}
            >
              <option value="PDF">PDF</option>
              <option value="Image">Image</option>
              <option value="Word">Word</option>
              <option value="Excel">Excel</option>
              <option value="Scanned File">Scanned File</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="modal-actions">
            <button className="doc-btn" onClick={() => setUploadModalOpen(false)} type="button">
              Cancel
            </button>
            <button className="doc-btn primary" type="submit">
              Upload Document
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
