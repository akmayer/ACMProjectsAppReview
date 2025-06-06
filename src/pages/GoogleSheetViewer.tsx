import { useEffect, useState, useRef } from 'react';
import { gapi } from 'gapi-script';
import { useSearchParams } from 'react-router-dom';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const SHEET_ID = '1K1kknP04sghLZHXclpcD5V0JFb8F5yLSFnH4vJJCj-c';
const SHEET_NAME = "'Form Responses 1'";
const REFRESH_INTERVAL = 20000;

interface SheetRow {
  data: string[];
  index: number;
}

export default function GoogleSheetViewer() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<SheetRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<SheetRow[]>([]);
  const [currentRow, setCurrentRow] = useState<string[]>([]);
  const [, setUserName] = useState('');
  const [searchParams] = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [newData, setNewData] = useState<string[] | null>(null);
  const [, setIsLoading] = useState(true);
  const lastDataRef = useRef<string[]>([]);
  const [visibleSections, setVisibleSections] = useState({
    ai: true,
    design: true,
    hack: true,
    gameDev: true
  });

  // Load all sheet data initially
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
          await loadAllSheetData();
        });
    });
  }, []);

  // Filter rows based on name parameter and update current row based on page number
  useEffect(() => {
    if (allRows.length === 0) return;

    const nameFilter = searchParams.get('name');
    const pageParam = searchParams.get('q');
    const pageNum = pageParam ? parseInt(pageParam) : 1;

    // Filter rows if name parameter exists
    const filtered = nameFilter
      ? allRows.filter(row => row.data[13]?.toLowerCase().trim() === nameFilter.toLowerCase().trim())
      : allRows;

    setFilteredRows(filtered);

    // Set current row based on page number
    const currentIndex = pageNum - 1;
    if (currentIndex >= 0 && currentIndex < filtered.length) {
      const row = filtered[currentIndex];
      setCurrentRow(row.data);
      lastDataRef.current = row.data;
      const lastColumnIndex = headers.length - 1;
      setCommentText(row.data[lastColumnIndex] || '');
    }
  }, [allRows, searchParams, headers.length]);

  // Set up auto-refresh interval
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        await gapi.client.load('sheets', 'v4');
        const range = `${SHEET_NAME}!A1:BH`;
        const res = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range,
        });
        
        const rows = res.result.values || [];
        if (rows.length === 0) return;

        const newRows = rows.slice(1).map((row: string[], index: number) => ({
          data: row,
          index: index + 1
        }));

        // Check if current row has changed
        const currentPage = searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1;
        const currentIndex = currentPage - 1;
        const currentFilteredRow = filteredRows[currentIndex];
        
        if (currentFilteredRow) {
          const newRow = newRows.find((r: SheetRow) => r.index === currentFilteredRow.index);
          if (newRow) {
            const hasChanged = newRow.data.some((value: string | null | undefined, index: number) => {
              const currentValue = value || '';
              const previousValue = lastDataRef.current[index] || '';
              return currentValue !== previousValue;
            });

            if (hasChanged) {
              if (isEditing) {
                setNewData(newRow.data);
                setShowConflictWarning(true);
              } else {
                updateDataSmoothly(newRow.data);
              }
            }
          }
        }

        setAllRows(newRows);
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isEditing, searchParams, filteredRows]);

  const loadAllSheetData = async () => {
    setIsLoading(true);
    try {
      await gapi.client.load('sheets', 'v4');
    
      const range = `${SHEET_NAME}!A1:BH`;
      const res = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
      });
    
      const rows = res.result.values || [];
      if (rows.length === 0) return;

      setHeaders(rows[0] || []);
      const newRows = rows.slice(1).map((row: string[], index: number) => ({
        data: row,
        index: index + 1
      }));
      setAllRows(newRows);
    } catch (error) {
      console.error('Error loading sheet data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDataSmoothly = (newRow: string[]) => {
    lastDataRef.current = newRow;
    setCurrentRow(newRow);
    const lastColumnIndex = headers.length - 1;
    setCommentText(newRow[lastColumnIndex] || '');
  };

  const saveComment = async () => {
    const pageParam = searchParams.get('q');
    const pageNum = pageParam ? parseInt(pageParam) : 1;
    const currentIndex = pageNum - 1;
    const currentFilteredRow = filteredRows[currentIndex];
    
    if (!currentFilteredRow) return;

    const rowIndex = currentFilteredRow.index + 1; // +1 because we skipped header row
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
      
      // First, get the current value to check for conflicts
      const currentValue = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!${columnLetter}${rowIndex}`,
      });

      const existingValue = currentValue.result.values?.[0]?.[0] || '';
      const currentAnswerValue = currentRow[columnIndex - 1] || '';
      
      // If the value has changed since we started editing, show conflict warning
      if (existingValue !== currentAnswerValue) {
        setNewData([...currentRow.slice(0, -1), existingValue]);
        setShowConflictWarning(true);
        return;
      }

      // If no conflict, proceed with saving
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!${columnLetter}${rowIndex}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[commentText]]
        }
      });

      // Update local state
      const newAnswers = [...currentRow];
      newAnswers[columnIndex - 1] = commentText;
      setCurrentRow(newAnswers);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving comment:', error);
      alert('Failed to save comment. Please try again.');
    }
  };

  // Function to determine section priorities
  const getSectionPriorities = () => {
    const priorities: { [key: string]: number } = {};
    const priorityResponses = currentRow.slice(13, 17); // Questions 14-17 (0-based index)
    
    priorityResponses.forEach((response, index) => {
      if (response) {
        const section = response.toLowerCase();
        if (['ai', 'hack', 'game dev', 'design'].includes(section)) {
          priorities[section === 'game dev' ? 'gameDev' : section] = index + 1;
        }
      }
    });
    
    return priorities;
  };

  useEffect(() => {
    const priorities = getSectionPriorities();
    setVisibleSections({
      ai: priorities.ai !== undefined,
      design: priorities.design !== undefined,
      hack: priorities.hack !== undefined,
      gameDev: priorities.gameDev !== undefined
    });
  }, [currentRow]);

  // Function to get priority label
  const getPriorityLabel = (section: string) => {
    const priorities = getSectionPriorities();
    const priority = priorities[section];
    if (priority === undefined) return '';
    return ` (#${priority} Priority)`;
  };

  // Helper function to convert URLs to clickable links
  const linkifyText = (text: string) => {
    if (!text) return text;
    
    // URL regex pattern
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    
    // Split text by URLs and map to elements
    const parts = text.split(urlPattern);
    return parts.map((part, index) => {
      if (part.match(urlPattern)) {
        return (
          <a 
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const scrollToComments = () => {
    const commentsSection = document.querySelector('.comments-section');
    if (commentsSection) {
      commentsSection.scrollIntoView({ behavior: 'smooth' });
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
            {currentRow[2] ? `Reviewing Applicant: ${currentRow[2]}` : 'Loading...'}
          </h1>
          <h1 className="text-md font-bold text-gray-800 mb-4">
            {currentRow[2] ? `${searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1} of ${filteredRows.length}` : ''}
          </h1>
          
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setVisibleSections(prev => ({ ...prev, ai: !prev.ai }))}
              className={`px-4 py-2 rounded-md transition-colors ${
                visibleSections.ai 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {visibleSections.ai ? `Hide AI${getPriorityLabel('ai')}` : 'Show AI'}
            </button>
            <button
              onClick={() => setVisibleSections(prev => ({ ...prev, design: !prev.design }))}
              className={`px-4 py-2 rounded-md transition-colors ${
                visibleSections.design 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {visibleSections.design ? `Hide Design${getPriorityLabel('design')}` : 'Show Design'}
            </button>
            <button
              onClick={() => setVisibleSections(prev => ({ ...prev, hack: !prev.hack }))}
              className={`px-4 py-2 rounded-md transition-colors ${
                visibleSections.hack 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {visibleSections.hack ? `Hide Hack${getPriorityLabel('hack')}` : 'Show Hack'}
            </button>
            <button
              onClick={() => setVisibleSections(prev => ({ ...prev, gameDev: !prev.gameDev }))}
              className={`px-4 py-2 rounded-md transition-colors ${
                visibleSections.gameDev 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {visibleSections.gameDev ? `Hide Game Dev${getPriorityLabel('gameDev')}` : 'Show Game Dev'}
            </button>
          </div>
          <div className="flex justify-end mb-4">
            <button
              onClick={scrollToComments}
              className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
            >
              Jump to Comments
            </button>
          </div>

          {!isEditing && (
            <div className="space-x-3">
              {(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) > 1 && (
                <a 
                  href={`/review?q=${(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) - 1}${searchParams.get('name') ? `&name=${searchParams.get('name')}` : ''}`}
                  className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
                >
                  ← Previous Response
                </a>
              )}
              {filteredRows.length > (searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) && (
                <a 
                  href={`/review?q=${(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) + 1}${searchParams.get('name') ? `&name=${searchParams.get('name')}` : ''}`}
                  className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
                >
                  Next Response →
                </a>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {/* General Questions */}
            <div className="bg-gray-50 p-4">
              <h2 className="text-xl font-bold text-gray-900">General Questions</h2>
            </div>
            {headers.slice(0, 17).map((question, i) => (
              <div key={i} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{question}</h3>
                </div>
                <div className="text-gray-700 whitespace-pre-wrap">
                  {currentRow[i] ? linkifyText(currentRow[i]) : (
                    <span className="text-gray-400 italic">No answer provided</span>
                  )}
                </div>
              </div>
            ))}

            {/* AI Questions */}
            {visibleSections.ai && (
              <>
                <div className="bg-gray-50 p-4">
                  <h2 className="text-xl font-bold text-gray-900">AI Questions</h2>
                </div>
                {headers.slice(17, 25).map((question, i) => (
                  <div key={i + 17} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{question}</h3>
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {currentRow[i + 17] ? linkifyText(currentRow[i + 17]) : (
                        <span className="text-gray-400 italic">No answer provided</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Design Questions */}
            {visibleSections.design && (
              <>
                <div className="bg-gray-50 p-4">
                  <h2 className="text-xl font-bold text-gray-900">Design Questions</h2>
                </div>
                {headers.slice(25, 34).map((question, i) => (
                  <div key={i + 25} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{question}</h3>
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {currentRow[i + 25] ? linkifyText(currentRow[i + 25]) : (
                        <span className="text-gray-400 italic">No answer provided</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Hack Questions */}
            {visibleSections.hack && (
              <>
                <div className="bg-gray-50 p-4">
                  <h2 className="text-xl font-bold text-gray-900">Hack Questions</h2>
                </div>
                {headers.slice(34, 47).map((question, i) => (
                  <div key={i + 34} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{question}</h3>
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {currentRow[i + 34] ? linkifyText(currentRow[i + 34]) : (
                        <span className="text-gray-400 italic">No answer provided</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Game Dev Questions */}
            {visibleSections.gameDev && (
              <>
                <div className="bg-gray-50 p-4">
                  <h2 className="text-xl font-bold text-gray-900">Game Dev Questions</h2>
                </div>
                {headers.slice(47, 53).map((question, i) => (
                  <div key={i + 47} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{question}</h3>
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {currentRow[i + 47] ? linkifyText(currentRow[i + 47]) : (
                        <span className="text-gray-400 italic">No answer provided</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Other Questions */}
            <div className="bg-gray-50 p-4">
              <h2 className="text-xl font-bold text-gray-900">Other Questions</h2>
            </div>
            {headers.slice(53, 59).map((question, i) => (
              <div key={i + 53} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{question}</h3>
                </div>
                <div className="text-gray-700 whitespace-pre-wrap">
                  {currentRow[i + 53] ? linkifyText(currentRow[i + 53]) : (
                    <span className="text-gray-400 italic">No answer provided</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-gray-100 rounded-lg shadow-lg overflow-hidden comments-section">
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
                      setCommentText(currentRow[lastColumnIndex] || '');
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
                {currentRow[headers.length - 1] || (
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
                  href={`/review?q=${(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) - 1}${searchParams.get('name') ? `&name=${searchParams.get('name')}` : ''}`}
                  className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
                >
                  ← Previous Response
                </a>
              )}
              {filteredRows.length > (searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) && (
                <a 
                  href={`/review?q=${(searchParams.get('q') ? parseInt(searchParams.get('q')!) : 1) + 1}${searchParams.get('name') ? `&name=${searchParams.get('name')}` : ''}`}
                  className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
                >
                  Next Response →
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
