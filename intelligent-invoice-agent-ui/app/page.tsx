'use client';

import { useState, useRef } from 'react';

type Screen = 'upload' | 'processing' | 'results';
type WorkflowStep = 'ocr' | 'validation' | 'rag';

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

export default function InvoiceQA() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('ocr');
  const [results, setResults] = useState<Results | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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
      console.log('API URL:', 'http://localhost:8080/api/v1/invoice-agent/upload');

      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(steps[i]);
        setProgress((i * 100) / 3);
      }

      const response = await fetch('http://localhost:8080/api/v1/invoice-agent/upload', {
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

      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">Invoice Agent</h1>
          <p className="text-lg mb-2">Intelligent invoice processing powered by <span className="font-semibold text-purple-600">MCP Server</span>, <span className="font-semibold text-blue-600">RAG</span>, and <span className="font-semibold text-indigo-600">AI</span></p>
          <p className="text-slate-600 text-sm">Upload your invoice and let our AI extract data, validate information, and generate insights automatically</p>
        </header>

        {screen === 'upload' && (
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

        {screen === 'processing' && (
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

        {screen === 'results' && results && (
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
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="text-red-700 font-semibold mb-2">Duplicate Details:</h4>
                      <div className="text-sm text-red-700 space-y-1">
                        <p><strong>Similarity Score:</strong> {results.duplicateDetails.similarity_score}</p>
                        <p><strong>Content:</strong> {results.duplicateDetails.duplicate_content}</p>
                        {results.duplicateDetails.metadata?.hash && (
                          <p><strong>Hash:</strong> {results.duplicateDetails.metadata.hash}</p>
                        )}
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
      </div>
    </div>
  );
}
