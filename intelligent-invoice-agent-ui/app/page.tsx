'use client';

import { useState, useRef, useEffect } from 'react';

type Screen = 'upload' | 'processing' | 'results';
type WorkflowStep = 'ocr' | 'validation' | 'rag';
type Tab = 'analysis' | 'vectordb' | 'stream';

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  vendor: string;
  amount: string;
  items: Array<{ description: string; quantity: number; price: string }>;
}

interface Results {
  extractedData: InvoiceData;
  validationPassed: boolean;
  ragInsights: string[];
  fieldsValidated: string[];
  rawJson: object;
  isDuplicate?: boolean;
  synthesis?: string;
  duplicateDetails?: any;
  recommendation?: string;
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

interface StreamData {
  id: string;
  name: string;
  email: string;
  city: string;
  balance: number;
}

export default function InvoiceQA() {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [screen, setScreen] = useState<Screen>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('ocr');
  const [results, setResults] = useState<Results | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [vectorDBData, setVectorDBData] = useState<VectorDBItem[]>([]);
  const [loadingVectorDB, setLoadingVectorDB] = useState(false);
  const [streamData, setStreamData] = useState<StreamData[]>([]);
  const [loadingStream, setLoadingStream] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
      setProgress(0);
    }
  };

  const processInvoice = async () => {
    if (!file) return;

    setScreen('processing');
    const steps: WorkflowStep[] = ['ocr', 'validation', 'rag'];
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('Uploading file:', file.name);
      console.log('API URL:', 'http://localhost:8081/api/v1/invoice-agent/upload');

      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(steps[i]);
        setProgress((i * 100) / 3);
      }

      const response = await fetch('http://localhost:8081/api/v1/invoice-agent/upload', {
        method: 'POST',
        body: formData
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Response data:', data);
      setProgress(100);

      const invoice = data.invoice || {};
      const validation = data.validation || {};
      const synthesis = data.synthesis || '';
      const isDuplicate = data.is_duplicate || false;
      const insights = synthesis && !isDuplicate ? [synthesis] : (data.ragInsights || []);
      const recommendation = synthesis.match(/Recommendation: ([^.]+)/)?.[1] || null;
      
      setResults({
        extractedData: {
          invoiceNumber: invoice.invoice_number || 'N/A',
          date: invoice.date || 'N/A',
          vendor: invoice.vendor || 'N/A',
          amount: invoice.total_amount || 'N/A',
          items: data.items || []
        },
        validationPassed: validation.overall_ok ?? true,
        ragInsights: insights,
        fieldsValidated: validation.fields_validated || [],
        rawJson: data,
        isDuplicate,
        synthesis,
        duplicateDetails: data.duplicate_details,
        recommendation
      });
      setScreen('results');
      
      // Refresh Vector DB data if on vectordb tab
      if (activeTab === 'vectordb') {
        fetchVectorDBData();
      }
    } catch (error) {
      console.error('Error processing invoice:', error);
      alert(`Failed to process invoice: ${error}`);
      setScreen('upload');
    }
  };

  const reset = () => {
    setScreen('upload');
    setFile(null);
    setProgress(0);
    setResults(null);
  };

  const downloadJson = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results.rawJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice-data.json';
    a.click();
  };

  const submitForPayment = () => {
    setShowPaymentModal(true);
  };

  const confirmPayment = async () => {
    if (!results) return;
    
    try {
      console.log('Submitting for payment:', results.extractedData);
      // TODO: Replace with your payment API endpoint
      // const response = await fetch('YOUR_PAYMENT_API_URL', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(results.rawJson)
      // });
      setShowPaymentModal(false);
      alert('Payment submitted successfully!');
    } catch (error) {
      console.error('Payment submission failed:', error);
      alert('Failed to submit payment. Please try again.');
    }
  };

  const fetchVectorDBData = async () => {
    setLoadingVectorDB(true);
    try {
      console.log('Fetching Vector DB data from:', 'http://localhost:8000/vector-db/invoices');
      const response = await fetch('http://localhost:8000/vector-db/invoices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      console.log('Vector DB Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Vector DB Response data:', data);
        console.log('Data type:', typeof data, 'Is array:', Array.isArray(data));
        
        // Handle different response formats
        if (Array.isArray(data)) {
          setVectorDBData(data);
        } else if (data.invoices && Array.isArray(data.invoices)) {
          setVectorDBData(data.invoices);
        } else if (data.data && Array.isArray(data.data)) {
          setVectorDBData(data.data);
        } else {
          console.error('Unexpected data format:', data);
          setVectorDBData([]);
        }
      } else {
        console.error('Vector DB API error:', response.status, response.statusText);
        alert(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch Vector DB data:', error);
      alert(`Network error: ${error.message}`);
    } finally {
      setLoadingVectorDB(false);
    }
  };

  const deleteVectorDBItem = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      console.log('Deleting invoice:', invoiceId);
      const response = await fetch(`http://localhost:8000/vector-db/invoice/${invoiceId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      console.log('Delete response status:', response.status);
      if (response.ok) {
        setVectorDBData(prev => prev.filter(item => item.id !== invoiceId));
        alert('Invoice deleted successfully!');
      } else {
        const errorText = await response.text();
        console.error('Delete failed:', response.status, errorText);
        alert(`Failed to delete: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      alert('Failed to delete invoice.');
    }
  };

  const clearAllVectorDB = async () => {
    console.log('Clear All button clicked');
    if (!confirm('Are you sure you want to clear ALL invoices from the database? This action cannot be undone.')) {
      console.log('Clear operation cancelled by user');
      return;
    }
    
    console.log('Clearing all invoices from vector database');
    console.log('Making request to:', 'http://localhost:8000/vector-db/clear?confirm=true');
    
    try {
      const response = await fetch('http://localhost:8000/vector-db/clear?confirm=true', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      
      console.log('Clear response received');
      console.log('Clear response status:', response.status);
      console.log('Clear response ok:', response.ok);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('Clear response data:', responseData);
        setVectorDBData([]);
        console.log('Database cleared successfully');
        alert('All invoices cleared successfully!');
        // Refresh data to confirm clearing
        fetchVectorDBData();
      } else {
        const errorText = await response.text();
        console.error('Clear failed:', response.status, errorText);
        alert(`Failed to clear database: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to clear database - Network error:', error);
      console.error('Error details:', error.message, error.stack);
      alert(`Failed to clear database: ${error.message}`);
    }
  };

  const connectToSSE = () => {
    console.log('Connecting to SSE:', 'http://localhost:8081/api/v1/stream');
    const eventSource = new EventSource('http://localhost:8081/api/v1/stream');
    
    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setLoadingStream(false);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStreamData(prev => {
          const exists = prev.find(item => item.id === data.id);
          if (exists) {
            console.log('Updating existing record:', data.id);
            return prev.map(item => item.id === data.id ? data : item);
          } else {
            console.log('Adding new record:', data.id);
            return [...prev, data];
          }
        });
      } catch (error) {
        console.error('Error parsing SSE data:', error, 'Raw data:', event.data);
      }
    };
    
    // Listen for any custom events
    eventSource.addEventListener('data', (event) => {
      console.log('SSE custom data event:', event);
    });
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      console.log('EventSource readyState:', eventSource.readyState);
      setLoadingStream(false);
    };
    
    return eventSource;
  };

  // Load Vector DB data when switching to vectordb tab
  useEffect(() => {
    if (activeTab === 'vectordb') {
      fetchVectorDBData();
    }
  }, [activeTab]);

  // Connect to SSE when stream tab is active
  useEffect(() => {
    let eventSource: EventSource | null = null;
    if (activeTab === 'stream') {
      console.log('Stream tab activated, connecting to SSE');
      setLoadingStream(true);
      eventSource = connectToSSE();
    }
    return () => {
      if (eventSource) {
        console.log('Closing SSE connection');
        eventSource.close();
      }
    };
  }, [activeTab]);

  const formatInsight = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const boldMatch = line.match(/\*\*(.+?)\*\*:?(.*)/);
      if (boldMatch) {
        return (
          <li key={idx} className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-slate-700">
              <strong className="font-semibold text-slate-900">{boldMatch[1]}</strong>
              {boldMatch[2] && `: ${boldMatch[2].trim()}`}
            </span>
          </li>
        );
      }
      return line.trim() ? (
        <li key={idx} className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-slate-700">{line}</span>
        </li>
      ) : null;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      {showPaymentModal && results && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
          <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-800">Confirm Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-1">Vendor</p>
                <p className="font-semibold text-slate-800">{results.extractedData.vendor}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-1">Payment Method</p>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="font-semibold text-slate-800">Bank - Checking Account</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-1">Account Information</p>
                <p className="font-mono text-slate-800">****-****-****-1234</p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                <p className="text-sm text-emerald-600 mb-1">Payment Amount</p>
                <p className="text-3xl font-bold text-emerald-700">{results.extractedData.amount}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmPayment}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-green-700 shadow-lg transition-all"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">Invoice Agent</h1>
          <p className="text-lg mb-2">Intelligent invoice processing powered by <span className="font-semibold text-purple-600">MCP Server</span>, <span className="font-semibold text-blue-600">RAG</span>, and <span className="font-semibold text-indigo-600">AI</span></p>
          <p className="text-slate-600 text-sm">Upload your invoice and let our AI extract data, validate information, and generate insights automatically</p>
        </header>

        <div className="mb-8">
          <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`flex-1 py-3 px-6 rounded-md font-semibold transition-all ${
                activeTab === 'analysis'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Invoice Analysis
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

        {activeTab === 'analysis' && screen === 'upload' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6">Upload Invoice</h2>
            
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
                className="hidden"
              />
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-lg text-slate-700 mb-2">Drop invoice here or click to browse</p>
              <p className="text-sm text-slate-500">Supports PDF, XLSX, PNG, JPG (Max 10MB)</p>
            </div>

            {file && (
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="font-medium text-slate-800">{file.name}</p>
                      <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-red-500 hover:text-red-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={processInvoice}
              disabled={!file}
              className="w-full mt-6 bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
            >
              Start Processing
            </button>
          </div>
        )}

        {activeTab === 'analysis' && screen === 'processing' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6">Processing Invoice</h2>
            
            <div className="space-y-6">
              {(['ocr', 'validation', 'rag'] as WorkflowStep[]).map((step, idx) => (
                <div key={step} className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    currentStep === step ? 'bg-blue-500 animate-pulse' :
                    idx < ['ocr', 'validation', 'rag'].indexOf(currentStep) ? 'bg-green-500' : 'bg-slate-200'
                  }`}>
                    {idx < ['ocr', 'validation', 'rag'].indexOf(currentStep) ? (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-white font-semibold">{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 capitalize">{step === 'ocr' ? 'OCR Extraction' : step === 'validation' ? 'Data Validation' : 'RAG Analysis'}</p>
                    <p className="text-sm text-slate-500">{step === 'ocr' ? 'Extracting text from invoice' : step === 'validation' ? 'Validating extracted data' : 'Generating insights'}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <div className="flex justify-between text-sm text-slate-600 mb-2">
                <span>Overall Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && screen === 'results' && results && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-slate-800">Invoice Details</h2>
                  <div className="flex gap-2">
                    {results.recommendation && (
                      <div className={`px-4 py-2 rounded-full font-semibold ${
                        results.recommendation.toLowerCase().includes('approve') 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {results.recommendation}
                      </div>
                    )}
                    <div className={`px-4 py-2 rounded-full ${results.validationPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {results.validationPassed ? '✓ Valid' : '✗ Invalid'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Invoice Number</p>
                    <p className="font-semibold text-slate-800">{results.extractedData.invoiceNumber}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Date</p>
                    <p className="font-semibold text-slate-800">{results.extractedData.date}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Vendor</p>
                    <p className="font-semibold text-slate-800">{results.extractedData.vendor}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Total Amount</p>
                    <p className="font-semibold text-slate-800">{results.extractedData.amount}</p>
                  </div>
                </div>

                {results.extractedData.items.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-3">Line Items</p>
                    <div className="space-y-2">
                      {results.extractedData.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between p-3 bg-slate-50 rounded-lg">
                          <span className="text-slate-800">{item.description} (x{item.quantity})</span>
                          <span className="font-semibold text-slate-800">{item.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {results.isDuplicate && results.synthesis ? (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl shadow-lg p-8">
                  <h3 className="text-xl font-semibold text-red-800 mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Duplicate Detection Alert
                  </h3>
                  <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-4">
                    <p className="text-red-800 font-medium">{results.synthesis}</p>
                  </div>
                  {results.duplicateDetails && (
                    <div className="space-y-3">
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h4 className="text-orange-700 font-semibold mb-2 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Similarity Analysis
                        </h4>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-orange-600 mb-1">
                            {(results.duplicateDetails.similarity_score * 100).toFixed(1)}%
                          </div>
                          <div className="text-sm text-orange-600">Match Confidence</div>
                        </div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-red-700 font-semibold mb-2">Duplicate Details:</h4>
                        <div className="text-sm text-red-700 space-y-1">
                          <p><strong>Content:</strong> {results.duplicateDetails.duplicate_content}</p>
                          {results.duplicateDetails.metadata?.hash && (
                            <p><strong>Hash:</strong> {results.duplicateDetails.metadata.hash}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h3 className="text-xl font-semibold text-slate-800 mb-4">AI Insights & Analysis</h3>
                  <ul className="space-y-2">
                    {results.ragInsights.map((insight, idx) => formatInsight(insight))}
                  </ul>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={downloadJson} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-all">
                  Download JSON
                </button>
                <button onClick={reset} className="flex-1 bg-slate-600 text-white py-4 rounded-xl font-semibold hover:bg-slate-700 transition-all">
                  Process Another
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {results.fieldsValidated.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Validation Status</h3>
                  <div className="space-y-2">
                    {results.fieldsValidated.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-slate-800 text-sm capitalize">{field.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Actions</h3>
                <button
                  onClick={submitForPayment}
                  disabled={results.isDuplicate}
                  className={`w-full py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                    results.isDuplicate 
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 hover:shadow-xl transform hover:scale-[1.02]'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Submit Payment
                </button>
              </div>

              <details className="bg-white rounded-2xl shadow-lg p-6">
                <summary className="text-lg font-semibold text-slate-800 cursor-pointer">View JSON</summary>
                <pre className="mt-4 bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                  {JSON.stringify(results.rawJson, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {activeTab === 'vectordb' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">Vector Database Management</h2>
              <div className="flex gap-3">
                <button
                  onClick={fetchVectorDBData}
                  disabled={loadingVectorDB}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-400 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {loadingVectorDB ? 'Loading...' : 'Refresh'}
                </button>
                <button
                  onClick={() => {
                    console.log('Clear All button clicked - handler called');
                    clearAllVectorDB();
                  }}
                  disabled={loadingVectorDB}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:bg-slate-400 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear All
                </button>
              </div>
            </div>

            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">{vectorDBData.length}</div>
                  <div className="text-sm text-slate-600">Total Invoices</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-green-600">
                    {vectorDBData.length}
                  </div>
                  <div className="text-sm text-slate-600">Active Invoices</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">
                    {new Set(vectorDBData.map(item => item.metadata?.hash)).size}
                  </div>
                  <div className="text-sm text-slate-600">Unique Hashes</div>
                </div>
              </div>
            </div>

            {loadingVectorDB ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-slate-600">Loading vector database...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {vectorDBData.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-lg font-medium">No data found</p>
                    <p className="text-sm">Vector database is empty</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left p-3 border-b font-semibold text-slate-700">Invoice ID</th>
                          <th className="text-left p-3 border-b font-semibold text-slate-700">Content</th>
                          <th className="text-left p-3 border-b font-semibold text-slate-700">Status</th>
                          <th className="text-left p-3 border-b font-semibold text-slate-700">Created</th>
                          <th className="text-center p-3 border-b font-semibold text-slate-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vectorDBData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 border-b">
                              <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{item.id}</span>
                            </td>
                            <td className="p-3 border-b max-w-md">
                              <div className="truncate text-slate-800">{item.content_preview}</div>
                              {item.metadata && (
                                <details className="mt-1">
                                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">Hash: {item.metadata.hash}</summary>
                                  <pre className="mt-1 bg-slate-50 p-2 rounded text-xs overflow-x-auto max-h-32">
                                    {JSON.stringify(item.metadata, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </td>
                            <td className="p-3 border-b">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Active
                              </span>
                            </td>
                            <td className="p-3 border-b text-sm text-slate-600">
                              N/A
                            </td>
                            <td className="p-3 border-b text-center">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('Delete button clicked for:', item.id);
                                  deleteVectorDBItem(item.id);
                                }}
                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors text-sm font-medium inline-flex items-center gap-1 cursor-pointer"
                                type="button"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stream' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">Stream Transport MCP Server</h2>
              <div className="flex items-center gap-2">
                {loadingStream && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                )}
                <span className="text-sm text-slate-500">Auto-refresh every 10s</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left p-3 border-b font-semibold text-slate-700">ID</th>
                    <th className="text-left p-3 border-b font-semibold text-slate-700">Name</th>
                    <th className="text-left p-3 border-b font-semibold text-slate-700">Email</th>
                    <th className="text-left p-3 border-b font-semibold text-slate-700">City</th>
                    <th className="text-right p-3 border-b font-semibold text-slate-700">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {streamData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-500">
                        <div className="flex flex-col items-center">
                          <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <p className="text-lg font-medium">No stream data available</p>
                          <p className="text-sm">Waiting for data from stream API...</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    streamData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-b">
                          <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{item.id}</span>
                        </td>
                        <td className="p-3 border-b font-medium text-slate-800">{item.name}</td>
                        <td className="p-3 border-b text-slate-600">{item.email}</td>
                        <td className="p-3 border-b text-slate-600">{item.city}</td>
                        <td className="p-3 border-b text-right">
                          <span className="font-semibold text-green-600">${item.balance.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">{streamData.length}</div>
                  <div className="text-sm text-slate-600">Total Records</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-green-600">
                    ${streamData.reduce((sum, item) => sum + item.balance, 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-slate-600">Total Balance</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Set(streamData.map(item => item.city)).size}
                  </div>
                  <div className="text-sm text-slate-600">Unique Cities</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
