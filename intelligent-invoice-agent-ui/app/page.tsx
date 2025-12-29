'use client';

import { useState, useRef, useEffect } from 'react';
import { Client } from '@stomp/stompjs';

type Screen = 'upload' | 'processing' | 'results';
type WorkflowStep = 'ocr' | 'validation' | 'rag';
type Tab = 'processing' | 'vectordb' | 'stream';
type ProcessingSubTab = 'manual' | 'automated' | 'queued';

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

export default function InvoiceQA() {
  const [activeTab, setActiveTab] = useState<Tab>('processing');
  const [activeProcessingTab, setActiveProcessingTab] = useState<ProcessingSubTab>('manual');
  const [processedInvoices, setProcessedInvoices] = useState<ProcessedInvoice[]>([]);
  const [queuedInvoices, setQueuedInvoices] = useState<QueuedInvoice[]>([]);
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
    if (activeTab === 'processing' && (activeProcessingTab === 'queued' || activeProcessingTab === 'automated')) {
      stompClient = connectToWebSocket();
    }
    return () => {
      if (stompClient) {
        stompClient.deactivate();
      }
    };
  }, [activeTab, activeProcessingTab]);

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
              onClick={() => setActiveTab('vectordb')}
              className={`flex-1 py-3 px-6 rounded-md font-semibold transition-all ${
                activeTab === 'vectordb'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Vector DB Management
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
              <button
                onClick={() => setActiveProcessingTab('queued')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all text-sm ${
                  activeProcessingTab === 'queued'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Failed Validation
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

        {activeTab === 'processing' && activeProcessingTab === 'queued' && (
          <FailedValidationComponent queuedInvoices={queuedInvoices} setQueuedInvoices={setQueuedInvoices} />
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
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Auto Processed Invoices</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <th className="text-left p-4 font-semibold text-slate-700">Invoice Number</th>
              <th className="text-left p-4 font-semibold text-slate-700">Vendor</th>
              <th className="text-left p-4 font-semibold text-slate-700">Vendor Code</th>
              <th className="text-left p-4 font-semibold text-slate-700">Service</th>
              <th className="text-left p-4 font-semibold text-slate-700">Date</th>
              <th className="text-left p-4 font-semibold text-slate-700">Total Amount</th>
              <th className="text-left p-4 font-semibold text-slate-700">Status</th>
              <th className="text-left p-4 font-semibold text-slate-700">Payment ID</th>
            </tr>
          </thead>
          <tbody>
            {processedInvoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td className="p-4">
                  <span className="font-mono">{invoice.invoiceNumber}</span>
                </td>
                <td className="p-4">{invoice.vendor}</td>
                <td className="p-4">
                  <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                    {invoice.vendorCode}
                  </span>
                </td>
                <td className="p-4">{invoice.service}</td>
                <td className="p-4">{invoice.date}</td>
                <td className="p-4">
                  <span className="font-semibold text-green-600">{invoice.totalAmount}</span>
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    invoice.status === 'APPROVE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="p-4">
                  <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                    {invoice.paymentId}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {processedInvoices.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-lg font-medium">No auto processed invoices</p>
          <p className="text-sm mt-2">Successfully processed invoices will appear here</p>
        </div>
      )}
    </div>
  );
}

// Failed Validation Component
function FailedValidationComponent({ queuedInvoices, setQueuedInvoices }: { queuedInvoices: QueuedInvoice[], setQueuedInvoices: React.Dispatch<React.SetStateAction<QueuedInvoice[]>> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<QueuedInvoice>>({});

  const handleEdit = (invoice: QueuedInvoice) => {
    setEditingId(invoice.id);
    setEditData(invoice);
  };

  const handleSave = (id: string) => {
    setQueuedInvoices(prev => prev.map(inv => 
      inv.id === id ? { ...inv, ...editData } : inv
    ));
    setEditingId(null);
    setEditData({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Failed Validation Invoices</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Invoice #</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Vendor</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Vendor Code</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Service</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Date</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Total Amount</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Expected Amount</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Status</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Description</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Rejection Reason</th>
              <th className="text-left p-3 font-semibold text-slate-700 text-sm">Filename</th>
              <th className="text-center p-3 font-semibold text-slate-700 text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queuedInvoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td className="p-3 text-sm">
                  {editingId === invoice.id ? (
                    <input
                      type="text"
                      value={editData.invoiceNumber || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <span className="font-mono">{invoice.invoiceNumber}</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  {editingId === invoice.id ? (
                    <input
                      type="text"
                      value={editData.vendor || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, vendor: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    invoice.vendor
                  )}
                </td>
                <td className="p-3 text-sm">
                  {editingId === invoice.id ? (
                    <input
                      type="text"
                      value={editData.vendorCode || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, vendorCode: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      {invoice.vendorCode}
                    </span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  {editingId === invoice.id ? (
                    <input
                      type="text"
                      value={editData.service || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, service: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    invoice.service
                  )}
                </td>
                <td className="p-3 text-sm">
                  {editingId === invoice.id ? (
                    <input
                      type="date"
                      value={editData.date || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    invoice.date
                  )}
                </td>
                <td className="p-3 text-sm">
                  {editingId === invoice.id ? (
                    <input
                      type="text"
                      value={editData.totalAmount || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, totalAmount: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <span className="font-semibold text-green-600">{invoice.totalAmount}</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  {editingId === invoice.id ? (
                    <input
                      type="text"
                      value={editData.expectedAmount || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, expectedAmount: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <span className="font-semibold text-blue-600">{invoice.expectedAmount}</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    REJECT
                  </span>
                </td>
                <td className="p-3 text-sm max-w-xs">
                  {editingId === invoice.id ? (
                    <textarea
                      value={editData.description || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm h-16 resize-none"
                    />
                  ) : (
                    <div className="truncate" title={invoice.description}>{invoice.description}</div>
                  )}
                </td>
                <td className="p-3 text-sm">
                  <div className="text-red-600 text-xs font-medium bg-red-50 px-2 py-1 rounded">
                    {invoice.rejectionReason}
                  </div>
                </td>
                <td className="p-3 text-sm">
                  <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                    {invoice.filename}
                  </span>
                </td>
                <td className="p-3 text-center">
                  {editingId === invoice.id ? (
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => handleSave(invoice.id)}
                        className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => handleEdit(invoice)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => console.log('Submit invoice:', invoice.id)}
                        className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Submit
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {queuedInvoices.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-lg font-medium">No rejected invoices</p>
        </div>
      )}
    </div>
  );
}