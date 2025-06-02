import { useEffect, useState } from 'react';
import { gapi } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const SHEET_ID = '1UmwPGwSHKtmO9baNfPkftoZ7BboQ56xc9ud4YXpty0Y';
const RANGE = 'Form Responses 1!A1:B2';


export default function GoogleSheetViewer() {
  const [data, setData] = useState<string[][]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    gapi.load('client:auth2', async () => {
      await gapi.client.init({
        clientId: CLIENT_ID,
        scope: SCOPES,
      });

      const auth = gapi.auth2.getAuthInstance();
      setIsSignedIn(auth.isSignedIn.get());

      auth.isSignedIn.listen(setIsSignedIn);

      if (auth.isSignedIn.get()) {
        loadSheetData();
      }
    });
  }, []);

  const signIn = () => {
    gapi.auth2.getAuthInstance().signIn();
  };

  const signOut = () => {
    gapi.auth2.getAuthInstance().signOut();
  };

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
    <div className="p-4 font-mono text-sm">
      {isSignedIn ? (
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
      ) : (
        <button onClick={signIn} className="px-4 py-2 bg-blue-600 text-white rounded">
          Sign In
        </button>
      )}
    </div>
  );
  
}
