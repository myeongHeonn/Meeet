import { CreatePollForm } from "./components/create-poll-form";
import { LogoMark } from "./components/logo-mark";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-5 pb-8">
      <header className="mb-5">
        <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          <LogoMark className="h-7 w-auto" />
          Meeet
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          여러 명의 미팅 시간을 빠르게 정하세요. 가입 없이 바로 만들고 공유하세요.
        </p>
      </header>
      <CreatePollForm />
    </main>
  );
}
