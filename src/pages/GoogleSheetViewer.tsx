import { useEffect, useState, useRef } from 'react';
import { gapi } from 'gapi-script';
import { useSearchParams } from 'react-router-dom';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const SHEET_ID = '1UmwPGwSHKtmO9baNfPkftoZ7BboQ56xc9ud4YXpty0Y';
const SHEET_NAME = "'Form Responses 1'";
const REFRESH_INTERVAL = 5000; // 20 seconds

export default function GoogleSheetViewer() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [userName, setUserName] = useState('');
  const [searchParams] = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [newData, setNewData] = useState<string[] | null>(null);
  const lastDataRef = useRef<string[]>([]);

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

  // Set up auto-refresh interval
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const pageParam = searchParams.get('q');
      const pageNum = pageParam ? parseInt(pageParam) : 1;
      const rowIndex = pageNum + 1;
      
      try {
        await gapi.client.load('sheets', 'v4');
        const range = `${SHEET_NAME}!A1:BH${rowIndex}`;
        const res = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range,
        });
        
        const rows = res.result.values || [];
        const currentRow = rows[rowIndex - 1] || [];
        
        // Check if data has changed
        if (JSON.stringify(currentRow) !== JSON.stringify(lastDataRef.current)) {
          if (isEditing) {
            // If editing, show conflict warning
            setNewData(currentRow);
            setShowConflictWarning(true);
          } else {
            // If not editing, update smoothly
            updateDataSmoothly(currentRow);
          }
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isEditing, searchParams]);

  const updateDataSmoothly = (newRow: string[]) => {
    lastDataRef.current = newRow;
    setAnswers(newRow);
    const lastColumnIndex = headers.length - 1;
    setCommentText(newRow[lastColumnIndex] || '');
  };

  const loadSheetData = async (row: number) => {
    await gapi.client.load('sheets', 'v4');
  
    const range = `${SHEET_NAME}!A1:BH${row}`;
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });
  
    const rows = res.result.values || [];
    console.log('Loaded rows:', rows);
    console.log('Headers length:', rows[0]?.length);
    console.log('Answers length:', rows[row - 1]?.length);
  
    setHeaders(rows[0] || []);
    const currentRow = rows[row - 1] || [];
    lastDataRef.current = currentRow;
    setAnswers(currentRow);
    const lastColumnIndex = rows[0]?.length - 1;
    setCommentText(currentRow[lastColumnIndex] || '');
  };

  const saveComment = async () => {
    const pageParam = searchParams.get('q');
    const pageNum = pageParam ? parseInt(pageParam) : 1;
    const rowIndex = pageNum + 1;
    const columnIndex = headers.length; // Last column

    // Convert column index to letter (e.g., 1 = A, 2 = B, 27 = AA, etc.)
    const getColumnLetter = (index: number): string => {
      let temp = index;
      let letter = '';
      while (temp > 0) {
        const remainder = (temp - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        temp = Math.floor((temp - 1) / 26);
      }
      return letter;
    };

    try {
      const columnLetter = getColumnLetter(columnIndex);
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!${columnLetter}${rowIndex}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[commentText]]
        }
      });

      // Update local state
      const newAnswers = [...answers];
      newAnswers[columnIndex - 1] = commentText;
      setAnswers(newAnswers);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving comment:', error);
      alert('Failed to save comment. Please try again.');
    }
  };

  return (
    <div className="p-4">
      {showConflictWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">New Data Available</h3>
            <p className="text-gray-700 mb-4">
              New data has been detected while you were editing. Please copy your current comment before refreshing:
            </p>
            <div className="bg-gray-100 p-4 rounded mb-4">
              <pre className="whitespace-pre-wrap">{commentText}</pre>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  if (newData) {
                    updateDataSmoothly(newData);
                    setShowConflictWarning(false);
                    setIsEditing(false);
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            {userName ? `Reviewing as ${userName}` : 'Logged out'}
          </h1>
          {!isEditing && (
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
          )}
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Reviewer Comments</h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
                >
                  Edit Comment
                </button>
              ) : (
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      const lastColumnIndex = headers.length - 1;
                      setCommentText(answers[lastColumnIndex] || '');
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveComment}
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors shadow-sm"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full h-32 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your review comments here..."
              />
            ) : (
              <div className="text-gray-700 whitespace-pre-wrap">
                {answers[headers.length - 1] || (
                  <span className="text-gray-400 italic">No comments yet</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-x-3">
          {!isEditing && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
