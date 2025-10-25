export function Background() {
  return (
    <svg
      fill="none"
      height="512"
      viewBox="0 0 1024 512"
      width="1024"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className="absolute inset-0 object-cover text-background"
    >
      <pattern id="a" height="64" patternUnits="userSpaceOnUse" width="64">
        <path d="m0 0h64v64h-64z" fill="currentColor" />
        <path
          d="m32 0h-32v32h8v-8h8v-8h8v-8h8zm-16 56h-8v8h32v-8h8v-8h8v-8h8v-32h-8v8h-8v8h-8v8h-8v8h-8v8h-8z"
          fill="white"
          fillOpacity="0.1"
        />
      </pattern>
      <path d="m0 0h1024v512h-1024z" fill="url(#a)" />
    </svg>
  );
}
