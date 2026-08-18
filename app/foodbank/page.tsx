import AdminPanel from "../_components/AdminPanel";

/** 시연 때 두 번째 창으로 기관 역할을 띄우기 위한 딥링크. */
export default function FoodBankAdminPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 20px 48px",
      }}
    >
      <AdminPanel refreshKey={0} />
    </main>
  );
}
