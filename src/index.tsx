import { ActionPanel, CopyToClipboardAction, List, OpenInBrowserAction, showToast, ToastStyle } from "@raycast/api";
import algolia, { SearchIndex } from "algoliasearch/lite";
import { useEffect, useState } from "react";

export default function DocList() {
  const [state, setState] = useState<{
    loading: boolean;
    searchText: string | null;
    docs: { [key: string]: Document[] };
  }>({
    loading: false,
    searchText: null,
    docs: {},
  });

  const client = algolia("BH4D9OD16A", "bc6e8acb44ed4179c30d0a45d6140d3f");
  client.addAlgoliaAgent("Raycast Extension");
  const index = client.initIndex("vuejs-v3");

  useEffect(() => {
    async function fetch() {
      setState((oldState) => ({ ...oldState, loading: true }));
      const docs = await fetchDocs(index, state.searchText);

      setState((oldState) => ({
        ...oldState,
        loading: false,
        docs: docs,
      }));
    }

    if (state.searchText) {
      fetch();
    }
  }, [state.searchText]);

  function setSearchText(text: string) {
    setState((oldState) => ({
      ...oldState,
      docs: {},
      searchText: text,
    }));
  }

  return (
    <List
      isLoading={state.loading}
      throttle
      navigationTitle="Search VueJS Documentation"
      searchBarPlaceholder="Filter docs by name..."
      onSearchTextChange={setSearchText}
    >
      {Object.keys(state.docs).map((section) => (
        <List.Section title={section}>
          {(state.docs[section] ?? []).map((doc) => (
            <DocListItem key={doc.id} doc={doc} />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

function DocListItem(props: { doc: Document }) {
  const doc = props.doc;
  return (
    <List.Item
      id={doc.id}
      key={doc.id}
      title={doc.title}
      subtitle={doc.subtitle}
      icon="vuejs.png"
      actions={
        <ActionPanel>
          <OpenInBrowserAction url={doc.url} />
          <CopyToClipboardAction title="Copy URL" content={doc.url} />
        </ActionPanel>
      }
    />
  );
}

async function fetchDocs(index: SearchIndex, query?: string | null): Promise<{ [key: string]: Document[] }> {
  try {
    const response = await index.search<AlgoliaDocument>(query ?? "", { hitsPerPage: 20, distinct: 1 });
    const filtered = response.hits.reduce((c, hit) => {
      const url = hit.url;
      const section = hit.hierarchy["lvl0"];
      const title = hit.hierarchy[hit.type];
      let subtitle = null;

      if (title !== hit.hierarchy["lvl1"]) {
        subtitle = hit.hierarchy["lvl1"];
      }

      if (c[url] === undefined) {
        c[url] = {
          id: hit.objectID,
          title: title as string,
          section: section as string,
          subtitle: subtitle as string,
          url,
        };
      }

      return c;
    }, {} as { [key: string]: Document });

    return Object.values(filtered).reduce((c, d) => {
      const section = d.section;
      if (c[section] === undefined) {
        c[section] = [];
      }

      if (c[section].length < 5) {
        c[section].push(d);
      }
      return c;
    }, {} as { [key: string]: Document[] });
  } catch (error) {
    console.error(error);
    showToast(ToastStyle.Failure, "Could not load docs");
    return Promise.resolve({});
  }
}

type Hierarchy = { [key: string]: string | null | undefined };

type AlgoliaDocument = {
  anchor: string;
  content: null;
  type: string;
  hierarchy: Hierarchy;
  url: string;
  objectID: string;
};

type Document = {
  id: string;
  section: string;
  title: string;
  subtitle: string;
  url: string;
};
