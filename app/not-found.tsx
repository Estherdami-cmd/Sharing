import Link from "next/link";
import SiteLayout from "./(site)/layout";
import PageShell from "./_components/PageShell";
import { btnPrimary, pageDesc, pageTitle } from "./ui";

/** 없는 주소는 (site) 레이아웃 밖에서 처리되므로, 헤더·푸터를 여기서 직접 씌운다. */
export default function NotFound() {
  return (
    <SiteLayout>
      <PageShell>
        <div className="mx-auto flex min-h-[40vh] w-full max-w-sm flex-col items-center justify-center gap-4 text-center">
          <div>
            <h1 className={pageTitle}>페이지를 찾을 수 없어요</h1>
            <p className={pageDesc}>주소가 잘못됐거나 없어진 페이지예요</p>
          </div>
          <Link href="/" className={btnPrimary}>
            처음으로
          </Link>
        </div>
      </PageShell>
    </SiteLayout>
  );
}
