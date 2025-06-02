import { useEffect, useState } from 'react';
import { gapi } from 'gapi-script';
import { useSearchParams } from 'react-router-dom';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const SHEET_ID = '1UmwPGwSHKtmO9baNfPkftoZ7BboQ56xc9ud4YXpty0Y';
const SHEET_NAME = "'Form Responses 1'";

export default function GoogleSheetViewer() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [userName, setUserName] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    gapi.load('client:auth2', () => {
      gapi.client
        .init({
          clientId: CLIENT_ID,
          scope: SCOPES,
        })
        .then(async () => {
          const auth = gapi.auth2.getAuthInstance();
          setUserName(auth.currentUser.get().getBasicProfile().getName());

          const pageParam = searchParams.get('q');
          const pageNum = pageParam ? parseInt(pageParam) : 1;
          const rowIndex = pageNum + 1; 

          await loadSheetData(rowIndex);
        });
    });
  }, [searchParams]);

  const loadSheetData = async (row: number) => {
    await gapi.client.load('sheets', 'v4');
  
    const range = `${SHEET_NAME}!A1:BH${row}`;
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });
  
    const rows = res.result.values || [];
  
    setHeaders(rows[0] || []);
    setAnswers(rows[row - 1] || []); 
  };

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            {userName ? `Reviewing as ${userName}` : 'Logged out'}
          </h1>
          <div className="space-x-3">
            {(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) > 1 && (
              <a 
                href={`/review?q=${(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) - 1}`}
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
              >
                ← Previous Response
              </a>
            )}
            <a 
              href={`/review?q=${(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) + 1}`}
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
            >
              Next Response →
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {headers.slice(0, -1).map((question, i) => (
              <div key={i} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{question}</h3>
                </div>
                <div className="text-gray-700 whitespace-pre-wrap">
                  {answers[i] || (
                    <span className="text-gray-400 italic">No answer provided</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-gray-100 rounded-lg shadow-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reviewer Comments</h2>
            <div className="text-gray-700 whitespace-pre-wrap">
              {answers[answers.length - 1] || (
                <span className="text-gray-400 italic">No comments yet</span>
              )}
            </div>
          </div>
        </div>


        
        <div className="space-x-3">
            {(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) > 1 && (
              <a 
                href={`/review?q=${(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) - 1}`}
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
              >
                ← Previous Response
              </a>
            )}
            <a 
              href={`/review?q=${(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) + 1}`}
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
            >
              Next Response →
            </a>
          </div>
      </div>
    </div>
  );
}
