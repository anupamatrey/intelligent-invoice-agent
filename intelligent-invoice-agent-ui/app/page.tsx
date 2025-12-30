'use client';

import { useState, useRef, useEffect } from 'react';
import { Client } from '@stomp/stompjs';

type Screen = 'upload' | 'processing' | 'results';
type WorkflowStep = 'ocr' | 'validation' | 'rag';
type Tab = 'processing' | 'review' | 'vectordb' | 'stream';
type ProcessingSubTab = 'manual' | 'automated';
type ReviewSubTab = 'failed' | 'duplicate';

interface ProcessedInvoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  vendorCode: string;
  service: string;
  date: string;
  totalAmount: string;
  status: string;
  paymentId: string;
}

interface QueuedInvoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  vendorCode: string;
  service: string;
  date: string;
  totalAmount: string;
  expectedAmount: string;
  description: string;
  rejectionReason: string;
  filename: string;
  status: string;
}

interface VectorDBItem {
  id: string;
  content_preview: string;
  metadata: {
    hash: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface DuplicateInvoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  vendorCode: string;
  service: string;
  date: string;
  totalAmount: string;
  status: string;
  description: string;
  duplicateDetails?: {
    duplicate_content: string;
    similarity_score: number;
    metadata: {
      hash: string;
    };
  };
}

export default function InvoiceQA() {
  const [activeTab, setActiveTab] = useState<Tab>('processing');
  const [activeProcessingTab, setActiveProcessingTab] = useState<ProcessingSubTab>('manual');
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewSubTab>('failed');
  const [processedInvoices, setProcessedInvoices] = useState<ProcessedInvoice[]>([]);
  const [queuedInvoices, setQueuedInvoices] = useState<QueuedInvoice[]>([]);
  const [duplicateInvoices, setDuplicateInvoices] = useState<DuplicateInvoice[]>([]);
  const [vectorDBData, setVectorDBData] = useState<VectorDBItem[]>([]);
  const [loadingVectorDB, setLoadingVectorDB] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const connectToWebSocket = () => {
    const client = new Client({
      brokerURL: 'ws://localhost:8081/ws-invoice/websocket',
      onConnect: () => {
        setWsConnected(true);
        client.subscribe('/topic/invoices/rejected', (message) => {
          try {
            const data = JSON.parse(message.body);
            const rejectedInvoice: QueuedInvoice = {
              id: Date.now().toString(),
              invoiceNumber: data.invoice_number || 'N/A',
              vendor: data.vendor || 'N/A',
              vendorCode: data.vendor_code || 'N/A',
              service: data.service || 'N/A',
              date: data.date || 'N/A',
              totalAmount: data.amount ? `$${data.amount}` : 'N/A',
              expectedAmount: data.expected_amount ? `$${data.expected_amount}` : 'N/A',
              description: data.description || 'N/A',
              rejectionReason: data.rejection_reason || 'Validation failed',
              filename: data.filename || 'unknown.pdf',
              status: 'REJECT'
            };
            setQueuedInvoices(prev => [rejectedInvoice, ...prev]);
          } catch (error) {
            console.error('Error parsing rejected invoice:', error);
          }
        });
        client.subscribe('/topic/invoice-updates', (message) => {
          try {
            const response = JSON.parse(message.body);
            const invoice = response.invoice_data?.invoice;
            if (invoice && response.invoice_data?.next_action === 'APPROVE') {
              const processedInvoice: ProcessedInvoice = {
                id: response.message_id || Date.now().toString(),
                invoiceNumber: invoice.invoice_number || 'N/A',
                vendor: invoice.vendor || 'N/A',
                vendorCode: invoice.vendor_code || 'N/A',
                service: invoice.service || 'N/A',
                date: invoice.date || 'N/A',
                totalAmount: invoice.total_amount ? `$${invoice.total_amount}` : 'N/A',
                status: response.invoice_data.next_action || 'PENDING',
                paymentId: response.invoice_data.vector_doc_id || 'N/A'
              };
              setProcessedInvoices(prev => [processedInvoice, ...prev]);
            }
          } catch (error) {
            console.error('Error parsing processed invoice:', error);
          }
        });
        client.subscribe('/topic/duplicate_invoice', (message) => {
          try {
            const response = JSON.parse(message.body);
            const invoice = response.invoice_data?.invoice;
            if (invoice && response.invoice_data?.is_duplicate) {
              const duplicateInvoice: DuplicateInvoice = {
                id: response.message_id || Date.now().toString(),
                invoiceNumber: invoice.invoice_number || 'N/A',
                vendor: invoice.vendor || 'N/A',
                vendorCode: invoice.vendor_code || 'N/A',
                service: invoice.service || 'N/A',
                date: invoice.date || 'N/A',
                totalAmount: invoice.total_amount ? `$${invoice.total_amount}` : 'N/A',
                status: 'Duplicate',
                description: response.invoice_data?.synthesis || 'N/A',
                duplicateDetails: response.invoice_data?.duplicate_details
              };
              setDuplicateInvoices(prev => [duplicateInvoice, ...prev]);
            }
          } catch (error) {
            console.error('Error parsing duplicate invoice:', error);
          }
        });
      },
      onDisconnect: () => setWsConnected(false),
      onStompError: () => setWsConnected(false)
    });
    client.activate();
    return client;
  };

  const fetchVectorDBData = async () => {
    setLoadingVectorDB(true);
    try {
      const response = await fetch('http://localhost:8000/vector-db/invoices');
      if (response.ok) {
        const data = await response.json();
        setVectorDBData(data);
      }
    } catch (error) {
      console.error('Error fetching vector DB data:', error);
    } finally {
      setLoadingVectorDB(false);
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/vector-db/invoice/${invoiceId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await fetchVectorDBData();
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const clearAllInvoices = async () => {
    if (confirm('Are you sure you want to clear all invoices?')) {
      try {
        const response = await fetch('http://localhost:8000/vector-db/clear?confirm=true', {
          method: 'DELETE'
        });
        if (response.ok) {
          setVectorDBData([]);
        }
      } catch (error) {
        console.error('Error clearing invoices:', error);
      }
    }
  };

  useEffect(() => {
    let stompClient: Client | null = null;
    if ((activeTab === 'processing' && activeProcessingTab === 'automated') || activeTab === 'review') {
      stompClient = connectToWebSocket();
    }
    return () => {
      if (stompClient) {
        stompClient.deactivate();
      }
    };
  }, [activeTab, activeProcessingTab, activeReviewTab]);

  useEffect(() => {
    if (activeTab === 'vectordb') {
      fetchVectorDBData();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">Invoice Agent</h1>
        </header>

        <div className="mb-8">
          <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('processing')}
              className={`flex-1 py-3 px-6 rounded-md font-semibold transition-all ${
                activeTab === 'processing'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Invoice Processing
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 py-3 px-6 rounded-md font-semibold transition-all ${
                activeTab === 'review'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Review Queue
            </button>
            <button
              onClick={() => setActiveTab('vectordb')}
              className={`flex-1 py-3 px-6 rounded-md font-semibold transition-all ${
                activeTab === 'vectordb'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Vector DB Management
            </button>
            <button
              onClick={() => setActiveTab('stream')}
              className={`flex-1 py-3 px-6 rounded-md font-semibold transition-all ${
                activeTab === 'stream'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Stream Transport MCP Server
            </button>
          </div>
        </div>

        {activeTab === 'processing' && (
          <div className="mb-6">
            <div className="flex space-x-1 bg-slate-100 rounded-lg p-1 shadow-sm max-w-md">
              <button
                onClick={() => setActiveProcessingTab('manual')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all text-sm ${
                  activeProcessingTab === 'manual'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Manual Upload
              </button>
              <button
                onClick={() => setActiveProcessingTab('automated')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all text-sm ${
                  activeProcessingTab === 'automated'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Auto Processed
              </button>
            </div>
          </div>
        )}

        {activeTab === 'review' && (
          <div className="mb-6">
            <div className="flex space-x-1 bg-slate-100 rounded-lg p-1 shadow-sm max-w-md">
              <button
                onClick={() => setActiveReviewTab('failed')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all text-sm ${
                  activeReviewTab === 'failed'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Failed Validation
              </button>
              <button
                onClick={() => setActiveReviewTab('duplicate')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all text-sm ${
                  activeReviewTab === 'duplicate'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Duplicate Invoices
              </button>
            </div>
          </div>
        )}

        {activeTab === 'processing' && activeProcessingTab === 'manual' && (
          <ManualUploadComponent />
        )}

        {activeTab === 'processing' && activeProcessingTab === 'automated' && (
          <AutoProcessedComponent processedInvoices={processedInvoices} />
        )}

        {activeTab === 'review' && activeReviewTab === 'failed' && (
          <FailedValidationComponent queuedInvoices={queuedInvoices} setQueuedInvoices={setQueuedInvoices} />
        )}

        {activeTab === 'review' && activeReviewTab === 'duplicate' && (
          <DuplicateInvoiceComponent duplicateInvoices={duplicateInvoices} setDuplicateInvoices={setDuplicateInvoices} />
        )}

        {activeTab === 'vectordb' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">Vector DB Management</h2>
              <div className="flex gap-3">
                <button
                  onClick={fetchVectorDBData}
                  disabled={loadingVectorDB}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={clearAllInvoices}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <th className="text-left p-4 font-semibold text-slate-700">ID</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Content Preview</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Hash</th>
                    <th className="text-center p-4 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vectorDBData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                      <td className="p-4">
                        <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {item.id}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="text-slate-700 truncate" title={item.content_preview}>
                          {item.content_preview}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                          {item.metadata?.hash || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => deleteInvoice(item.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {vectorDBData.length === 0 && !loadingVectorDB && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg font-medium">No invoices in vector database</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Manual Upload Component
function ManualUploadComponent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('ocr');
  const [results, setResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startProcessing = async () => {
    if (!selectedFile) return;
    
    setCurrentScreen('processing');
    setProgress(0);
    setCurrentStep('ocr');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:8081/api/v1/invoice-agent/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setCurrentScreen('results');
      }
    } catch (error) {
      console.error('Error processing invoice:', error);
    }
  };

  const processAnother = () => {
    setCurrentScreen('upload');
    setSelectedFile(null);
    setResults(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (currentScreen === 'upload') {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-semibold text-slate-800 mb-6">Upload Invoice</h2>
        
        <div
          className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {selectedFile ? (
            <div className="space-y-4">
              <div className="text-green-600 text-4xl">✓</div>
              <div>
                <p className="text-lg font-semibold text-slate-800">{selectedFile.name}</p>
                <p className="text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className="text-red-500 hover:text-red-700 font-medium"
              >
                Remove file
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-slate-400 text-4xl">📄</div>
              <div>
                <p className="text-lg font-semibold text-slate-800">Drop your invoice here</p>
                <p className="text-slate-500">or click to browse files</p>
                <p className="text-sm text-slate-400 mt-2">Supports PDF, PNG, JPG, XLSX</p>
              </div>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="mt-6 text-center">
            <button
              onClick={startProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Start Processing
            </button>
          </div>
        )}
      </div>
    );
  }

  if (currentScreen === 'processing') {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-semibold text-slate-800 mb-8">Processing Invoice</h2>
        
        <div className="space-y-8">
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['ocr', 'validation', 'rag'] as WorkflowStep[]).map((step, index) => {
              const isActive = currentStep === step;
              const isCompleted = ['ocr', 'validation', 'rag'].indexOf(currentStep) > index;
              
              return (
                <div key={step} className={`p-6 rounded-xl border-2 transition-all ${
                  isActive ? 'border-blue-500 bg-blue-50' : 
                  isCompleted ? 'border-green-500 bg-green-50' : 'border-slate-200'
                }`}>
                  <div className="text-center">
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-blue-500 animate-pulse' :
                      isCompleted ? 'bg-green-500' : 'bg-slate-300'
                    }`}>
                      {isCompleted ? (
                        <span className="text-white text-xl">✓</span>
                      ) : (
                        <span className="text-white font-bold">{index + 1}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-800">
                      {step === 'ocr' ? 'OCR Extraction' :
                       step === 'validation' ? 'Data Validation' : 'AI Analysis'}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {step === 'ocr' ? 'Extracting text from invoice' :
                       step === 'validation' ? 'Validating extracted data' : 'Generating insights'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'results') {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-semibold text-slate-800 mb-6">Processing Results</h2>
        
        <div className="space-y-6">
          <div className="flex gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              results?.validation?.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {results?.validation?.isValid ? '✓ Valid' : '✗ Invalid'}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              results?.recommendation === 'APPROVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {results?.recommendation || 'Pending'}
            </span>
          </div>

          {results?.duplicateDetection?.isDuplicate && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-2">⚠️ Duplicate Detected</h3>
              <p className="text-red-700">Similarity: {(results.duplicateDetection.similarity * 100).toFixed(1)}%</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Extracted Data</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Invoice #:</span> {results?.extractedData?.invoiceNumber || 'N/A'}</div>
                <div><span className="font-medium">Date:</span> {results?.extractedData?.date || 'N/A'}</div>
                <div><span className="font-medium">Vendor:</span> {results?.extractedData?.vendor || 'N/A'}</div>
                <div><span className="font-medium">Amount:</span> ${results?.extractedData?.totalAmount || '0.00'}</div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-3">AI Insights</h3>
              <p className="text-sm text-slate-600">{results?.aiInsights || 'No insights available'}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={processAnother}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Process Another
            </button>
            {!results?.duplicateDetection?.isDuplicate && (
              <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Submit Payment
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Auto Processed Component
function AutoProcessedComponent({ processedInvoices }: { processedInvoices: ProcessedInvoice[] }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 via-green-600 to-green-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Auto Processed Invoices</h2>
                <p className="text-green-100 text-sm">Successfully processed and approved invoices</p>
              </div>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-full">
              <span className="text-white font-semibold">{processedInvoices.length} Processed</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          {processedInvoices.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Processed Invoices</h3>
              <p className="text-gray-500">Successfully processed invoices will appear here when approved by the system.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {processedInvoices.map((invoice) => (
                <div key={invoice.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{invoice.invoiceNumber}</h3>
                        <p className="text-sm text-gray-600">{invoice.vendor}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full border border-green-200">
                        {invoice.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Vendor Code</p>
                      <p className="font-mono text-sm font-semibold text-gray-900">{invoice.vendorCode}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Service</p>
                      <p className="text-sm font-semibold text-gray-900">{invoice.service}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</p>
                      <p className="text-sm font-semibold text-gray-900">{invoice.date}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Amount</p>
                      <p className="text-lg font-bold text-green-600">{invoice.totalAmount}</p>
                    </div>
                  </div>

                  <div className="bg-white/80 rounded-lg p-4 mb-6 border border-white">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">Processing Status</h4>
                        <div className="text-sm text-gray-700">
                          <p>Invoice successfully processed and approved for payment. All validation checks passed.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Processed automatically</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span className="font-mono text-xs">{invoice.paymentId}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Details
                      </button>
                      <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Process Payment
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Failed Validation Component
function FailedValidationComponent({ queuedInvoices, setQueuedInvoices }: { queuedInvoices: QueuedInvoice[], setQueuedInvoices: React.Dispatch<React.SetStateAction<QueuedInvoice[]>> }) {
  const [editingInvoice, setEditingInvoice] = useState<QueuedInvoice | null>(null);
  const [editData, setEditData] = useState<QueuedInvoice | null>(null);

  const handleEdit = (invoice: QueuedInvoice) => {
    setEditingInvoice(invoice);
    setEditData({ ...invoice });
  };

  const handleSave = () => {
    if (editData) {
      setQueuedInvoices(prev => prev.map(inv => 
        inv.id === editData.id ? editData : inv
      ));
      setEditingInvoice(null);
      setEditData(null);
    }
  };

  const handleSubmit = (invoice: QueuedInvoice) => {
    console.log('Submit invoice:', invoice);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-orange-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Failed Validation Invoices</h2>
                <p className="text-orange-100 text-sm">Invoices that require manual review and correction</p>
              </div>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-full">
              <span className="text-white font-semibold">{queuedInvoices.length} Failed</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          {queuedInvoices.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Failed Validations</h3>
              <p className="text-gray-500">All invoices passed validation. Failed invoices will appear here for review.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {queuedInvoices.map((invoice) => (
                <div key={invoice.id} className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{invoice.invoiceNumber}</h3>
                        <p className="text-sm text-gray-600">{invoice.vendor}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full border border-red-200">
                        REJECT
                      </span>
                      <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full border border-orange-200">
                        Invoice File Name: {invoice.filename}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Vendor Code</p>
                      <p className="font-mono text-sm font-semibold text-gray-900">{invoice.vendorCode}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Service</p>
                      <p className="text-sm font-semibold text-gray-900">{invoice.service}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</p>
                      <p className="text-sm font-semibold text-gray-900">{invoice.date}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Amount</p>
                      <p className="text-lg font-bold text-green-600">{invoice.totalAmount}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Expected</p>
                      <p className="text-lg font-bold text-blue-600">{invoice.expectedAmount}</p>
                    </div>
                  </div>

                  <div className="bg-white/80 rounded-lg p-4 mb-4 border border-white">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">Validation Issues</h4>
                        <div className="text-sm text-gray-700 mb-2">
                          <p>{invoice.description}</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-red-800 mb-1">Rejection Reason</p>
                          <p className="text-sm text-red-700">{invoice.rejectionReason}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Requires manual review</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleEdit(invoice)}
                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleSubmit(invoice)}
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg text-sm font-medium hover:from-orange-700 hover:to-orange-800 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Submit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingInvoice && editData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Failed Invoice
                </h3>
                <button
                  onClick={() => {setEditingInvoice(null); setEditData(null);}}
                  className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number</label>
                    <input
                      type="text"
                      value={editData.invoiceNumber}
                      onChange={(e) => setEditData({...editData, invoiceNumber: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor</label>
                    <input
                      type="text"
                      value={editData.vendor}
                      onChange={(e) => setEditData({...editData, vendor: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor Code</label>
                    <input
                      type="text"
                      value={editData.vendorCode}
                      onChange={(e) => setEditData({...editData, vendorCode: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Service</label>
                    <input
                      type="text"
                      value={editData.service}
                      onChange={(e) => setEditData({...editData, service: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={editData.date}
                      onChange={(e) => setEditData({...editData, date: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Total Amount</label>
                    <input
                      type="text"
                      value={editData.totalAmount}
                      onChange={(e) => setEditData({...editData, totalAmount: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Expected Amount</label>
                    <input
                      type="text"
                      value={editData.expectedAmount}
                      onChange={(e) => setEditData({...editData, expectedAmount: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({...editData, description: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 h-24 resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={handleSave}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </button>
              <button
                onClick={() => {setEditingInvoice(null); setEditData(null);}}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Duplicate Invoice Component
function DuplicateInvoiceComponent({ duplicateInvoices, setDuplicateInvoices }: { duplicateInvoices: DuplicateInvoice[], setDuplicateInvoices: React.Dispatch<React.SetStateAction<DuplicateInvoice[]>> }) {
  const [editingInvoice, setEditingInvoice] = useState<DuplicateInvoice | null>(null);
  const [editData, setEditData] = useState<DuplicateInvoice | null>(null);
  const [showDuplicateDetails, setShowDuplicateDetails] = useState<DuplicateInvoice | null>(null);

  const handleEdit = (invoice: DuplicateInvoice) => {
    setEditingInvoice(invoice);
    setEditData({ ...invoice });
  };

  const handleSave = () => {
    if (editData) {
      setDuplicateInvoices(prev => prev.map(inv => 
        inv.id === editData.id ? editData : inv
      ));
      setEditingInvoice(null);
      setEditData(null);
    }
  };

  const handleSubmit = (invoice: DuplicateInvoice) => {
    console.log('Submit invoice:', invoice);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Duplicate Invoices</h2>
                <p className="text-red-100 text-sm">Invoices flagged as potential duplicates</p>
              </div>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-full">
              <span className="text-white font-semibold">{duplicateInvoices.length} Found</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          {duplicateInvoices.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Duplicate Invoices</h3>
              <p className="text-gray-500">All invoices are unique. Duplicate invoices will appear here when detected.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {duplicateInvoices.map((invoice) => (
                <div key={invoice.id} className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{invoice.invoiceNumber}</h3>
                        <p className="text-sm text-gray-600">{invoice.vendor}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full border border-red-200">
                        DUPLICATE
                      </span>
                      {invoice.duplicateDetails && (
                        <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full border border-orange-200">
                          Confidence Score: {Math.round(invoice.duplicateDetails.similarity_score * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Vendor Code</p>
                      <p className="font-mono text-sm font-semibold text-gray-900">{invoice.vendorCode}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Service</p>
                      <p className="text-sm font-semibold text-gray-900">{invoice.service}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</p>
                      <p className="text-sm font-semibold text-gray-900">{invoice.date}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Amount</p>
                      <p className="text-lg font-bold text-green-600">{invoice.totalAmount}</p>
                    </div>
                  </div>

                  <div className="bg-white/80 rounded-lg p-4 mb-6 border border-white">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">Duplicate Alert</h4>
                        <div className="text-sm text-gray-700">
                          {invoice.description.includes('DUPLICATE DETECTED') ? (
                            <div>
                              {invoice.description.split('DUPLICATE DETECTED')[0]}
                              <button
                                onClick={() => setShowDuplicateDetails(invoice)}
                                className="inline-flex items-center text-red-600 hover:text-red-800 font-semibold underline decoration-2 underline-offset-2 transition-colors mx-1"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                DUPLICATE DETECTED
                              </button>
                              {invoice.description.split('DUPLICATE DETECTED')[1]}
                            </div>
                          ) : (
                            invoice.description
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Detected just now</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleEdit(invoice)}
                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleSubmit(invoice)}
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Submit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingInvoice && editData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-100">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Invoice Details
                </h3>
                <button
                  onClick={() => {setEditingInvoice(null); setEditData(null);}}
                  className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number</label>
                  <input
                    type="text"
                    value={editData.invoiceNumber}
                    onChange={(e) => setEditData({...editData, invoiceNumber: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter invoice number"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor</label>
                    <input
                      type="text"
                      value={editData.vendor}
                      onChange={(e) => setEditData({...editData, vendor: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Vendor name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor Code</label>
                    <input
                      type="text"
                      value={editData.vendorCode}
                      onChange={(e) => setEditData({...editData, vendorCode: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Code"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Service</label>
                    <input
                      type="text"
                      value={editData.service}
                      onChange={(e) => setEditData({...editData, service: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Service type"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={editData.date}
                      onChange={(e) => setEditData({...editData, date: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Total Amount</label>
                  <input
                    type="text"
                    value={editData.totalAmount}
                    onChange={(e) => setEditData({...editData, totalAmount: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="$0.00"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={handleSave}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </button>
              <button
                onClick={() => {setEditingInvoice(null); setEditData(null);}}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl transform transition-all duration-300 scale-100">
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Duplicate Detection Details
                </h3>
                <button
                  onClick={() => setShowDuplicateDetails(null)}
                  className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h4 className="font-semibold text-red-800">Duplicate Invoice Alert</h4>
                </div>
                <p className="text-red-700 text-sm mb-4">{showDuplicateDetails.description}</p>
              </div>
              
              {showDuplicateDetails.duplicateDetails && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Duplicate Details
                    </h5>
                    <div className="bg-white p-4 rounded border font-mono text-sm text-gray-800 overflow-x-auto">
                      {`duplicate_content=${showDuplicateDetails.duplicateDetails.duplicate_content}, similarity_score=${showDuplicateDetails.duplicateDetails.similarity_score}, metadata={hash=${showDuplicateDetails.duplicateDetails.metadata.hash}}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end p-6 pt-0">
              <button
                onClick={() => setShowDuplicateDetails(null)}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-all duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}