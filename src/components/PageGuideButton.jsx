import { usePageGuide } from "../hooks/usePageGuide";

function PageGuideButton({ steps }) {
  const { startGuide } = usePageGuide(steps);

  return (
    <button
      className="page-guide-btn"
      onClick={startGuide}
      type="button"
      title="ดูคู่มือการใช้งาน"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      คู่มือ
    </button>
  );
}

export default PageGuideButton;
