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

    // Load headers (row 1)
    const headerRes = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:BG1`, // Adjust range as needed
    });

    // Load target row
    const answerRes = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A${row}:BG${row}`, // Row X only
    });

    setHeaders(headerRes.result.values?.[0] || []);
    setAnswers(answerRes.result.values?.[0] || []);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        {userName ? `Reviewing as ${userName}` : 'Logged out'}
      </h1>

      <table className="table-auto border border-black">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 text-left">Question</th>
            <th className="border border-black px-2 py-1 text-left">Answer</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((question, i) => (
            <tr key={i}>
              <td className="border border-black px-2 py-1">{question}</td>
              <td className="border border-black px-2 py-1">{answers[i] || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
