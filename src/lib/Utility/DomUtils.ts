export function createImageError() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <rect width="512" height="512" fill="lightgray" />
      <text
        x="50%"
        y="50%"
        font-family="sans-serif"
        font-size="3rem"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        Image Error
      </text>
    </svg>
  `;
  const encoded = `data:image/svg+xml;base64,${btoa(svg)}`;

  return encoded;
}