export default function Home() {
  return (
    <main>
      <h1>DROP Data Broker API — dev emulator</h1>
      <p>Local emulator of the California Delete Act DROP Data Broker API.</p>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cell}>Method</th>
            <th style={cell}>Path</th>
            <th style={cell}>Auth</th>
            <th style={cell}>Returns</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cell}>GET</td>
            <td style={cell}>
              <code>/data/download</code>
            </td>
            <td style={cell}>yes</td>
            <td style={cell}>ZIP of hashed consumer CSVs (streamed)</td>
          </tr>
          <tr>
            <td style={cell}>POST</td>
            <td style={cell}>
              <code>/data/upload</code>
            </td>
            <td style={cell}>yes</td>
            <td style={cell}>UploadResponse JSON (mode new)</td>
          </tr>
          <tr>
            <td style={cell}>POST</td>
            <td style={cell}>
              <code>/data/amend</code>
            </td>
            <td style={cell}>yes</td>
            <td style={cell}>UploadResponse JSON (mode amend)</td>
          </tr>
          <tr>
            <td style={cell}>GET</td>
            <td style={cell}>
              <a href="/preview">/preview</a>
            </td>
            <td style={cell}>no</td>
            <td style={cell}>personal.csv + derived hashes (HTML)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Auth via <code>X-API-KEY</code> header. Missing/invalid key &rarr;{" "}
        <code>401</code>.
      </p>
    </main>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "4px 8px",
  textAlign: "left",
};
