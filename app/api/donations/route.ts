import { NextResponse } from "next/server";
import { DEFAULT_REGION, isValidISODate, isValidPhone } from "@/lib/rules";
import { createCompany, findCompanyByCode } from "@/lib/company";
import { createDonation } from "@/lib/store";

// 클라이언트가 올릴 때 이미 줄여서 보내지만(RegisterFlow.tsx), 그 경로를 우회한
// 값까지 저장소에 그대로 쌓이지 않게 여기서도 형태와 크기를 한 번 더 본다.
const MAX_IMAGE_DATA_URL_LENGTH = 2_000_000;

/** 사진은 있으면 좋지만 없다고 등록을 막을 이유는 없다. 이상하면 그냥 없는 걸로 친다. */
function sanitizeImageDataUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("data:image/")) return null;
  if (value.length > MAX_IMAGE_DATA_URL_LENGTH) return null;
  return value;
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
  }
  const { itemName, category } = body;

  if (!itemName || !category) {
    return NextResponse.json({ error: "품목명과 카테고리가 필요합니다" }, { status: 400 });
  }
  if (body.expiryDate && !isValidISODate(body.expiryDate)) {
    return NextResponse.json({ error: "유통기한 형식이 올바르지 않습니다" }, { status: 400 });
  }
  // 상한 밖의 값은 store가 잘라주지만, 숫자가 아닌 건 조용히 1로 바꾸지 않고 되돌려준다.
  if (body.quantity !== undefined && !Number.isFinite(Number(body.quantity))) {
    return NextResponse.json({ error: "수량 형식이 올바르지 않습니다" }, { status: 400 });
  }

  // 기업·단체 기부. 이름은 결과 보고서에, 연락처는 배분기관이 수거 일정을 잡을 때 쓴다.
  let company: { name: string; manager: string; contact: string } | null = null;
  if (body.donorType === "company") {
    const name = typeof body.donorName === "string" ? body.donorName.trim().slice(0, 40) : "";
    const contact = typeof body.donorContact === "string" ? body.donorContact.replace(/\D/g, "") : "";
    if (!name) {
      return NextResponse.json({ error: "기업·단체 이름을 입력해주세요" }, { status: 400 });
    }
    if (!isValidPhone(contact)) {
      return NextResponse.json(
        { error: "담당자 연락처 형식을 다시 확인해주세요 (휴대폰 또는 지역번호 포함 유선 번호)" },
        { status: 400 },
      );
    }
    const manager = typeof body.donorManager === "string" ? body.donorManager.trim().slice(0, 20) : "";
    company = { name, manager, contact };
  }

  /*
    기업은 처음 기부할 때 자동으로 만들어지고 관리 코드를 받는다. 코드를 같이 보내면
    그 기업의 기부로 묶는다. 코드가 틀리면 새 기업을 만들지 않고 되돌린다 — 오타 하나로
    같은 회사가 둘로 갈라지지 않게.
  */
  let companyId: string | null = null;
  let issuedCode: string | null = null;
  if (company) {
    const givenCode = typeof body.companyCode === "string" ? body.companyCode.trim() : "";
    if (givenCode) {
      const found = await findCompanyByCode(givenCode);
      if (!found) {
        return NextResponse.json({ error: "기업 관리 코드를 찾을 수 없어요. 다시 확인해주세요" }, { status: 400 });
      }
      companyId = found.id;
    } else {
      const created = await createCompany(company);
      companyId = created.company.id;
      issuedCode = created.code;
    }
  }

  const donation = await createDonation({
    company,
    companyId,
    itemName,
    category,
    quantity: body.quantity,
    // date 인풋은 빈 값을 ""로 준다. 판정 함수가 null만 받도록 여기서 정규화한다.
    expiryDate: body.expiryDate || null,
    region: body.region || DEFAULT_REGION,
    genericName: typeof body.genericName === "string" && body.genericName.trim()
      ? body.genericName.trim()
      : null,
    productImageUrl: sanitizeImageDataUrl(body.productImageUrl),
    expiryImageUrl: sanitizeImageDataUrl(body.expiryImageUrl),
  });
  // 새로 발급한 코드는 이 응답에서 한 번만 원문으로 나간다.
  return NextResponse.json({ ...donation, companyCode: issuedCode });
}
