import { useEffect, useState } from 'react';
import { gapi } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const SHEET_ID = '1UmwPGwSHKtmO9baNfPkftoZ7BboQ56xc9ud4YXpty0Y';
const RANGE = "'Form Responses 1'!A1:B2"; // quotes are needed if sheet name has spaces

export default function GoogleSheetViewer() {
  const [data, setData] = useState<string[][]>([]);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    gapi.load('client:auth2', () => {
      gapi.client
        .init({
          clientId: CLIENT_ID,
          scope: SCOPES,
        })
        .then(() => {
            const auth = gapi.auth2.getAuthInstance();
            setUserName(auth.currentUser.get().getBasicProfile().getName());

            loadSheetData();
        });
    });
  }, []);


  const loadSheetData = async () => {
    await gapi.client.load('sheets', 'v4');
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });
    console.log(response.result.values);
    setData(response.result.values || []);
  };

  return (
    <div>
        <h1 className="text-2xl font-bold">
          {userName ? `Reviewing as ${userName}` : 'Logged out'}
        </h1>
    <table className="border border-black">
    <tbody>
        {[0, 1].map((i) => (
        <tr key={i}>
            {[0, 1].map((j) => (
            <td key={j} className="border border-black px-2 py-1">
                {(data[i] && data[i][j]) || ''}
            </td>
            ))}
        </tr>
        ))}
    </tbody>
    </table>
    </div>
  );
}
