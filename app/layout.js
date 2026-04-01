export const metadata = {
  title: "LeadPrice AI — Аудит + Project Vision",
  description: "AI-агент для аудиту та стратегічного планування Meta Ads & Google Ads",
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`* { margin: 0; padding: 0; box-sizing: border-box; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
