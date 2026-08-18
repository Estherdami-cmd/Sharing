import AdminPanel from "../_components/AdminPanel";
import { shell } from "../ui";

/** 시연 때 두 번째 창으로 기관 역할을 띄우기 위한 딥링크. 탭 없이 관리 화면만 보여준다. */
export default function FoodBankAdminPage() {
  return (
    <main className="flex min-h-screen flex-col items-center px-5 pt-8 pb-12 md:px-6 lg:px-8 xl:px-10">
      <div className={shell}>
        <AdminPanel refreshKey={0} />
      </div>
    </main>
  );
}
