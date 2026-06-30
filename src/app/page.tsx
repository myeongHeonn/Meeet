import { CreatePollForm } from "./components/create-poll-form";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Meeet</h1>
        <p className="text-sm text-gray-600">
          여러 명의 미팅 시간을 빠르게 정하세요. 가입 없이 바로 만들고 공유하세요.
        </p>
      </header>
      <CreatePollForm />
    </main>
  );
}
